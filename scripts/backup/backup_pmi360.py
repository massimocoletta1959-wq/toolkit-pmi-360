#!/usr/bin/env python3
"""Backup giornaliero di Pmi 360° (database di produzione + file) sul Mac del titolare.

Avviato da launchd all'accesso e poi ogni ora (it.pmi360.backup.plist): fa UNA copia al giorno, se quella di oggi
manca. Contenuto di ogni copia, in ~/Backup-pmi360/AAAA-MM-GG_HHMM/:
  2_struttura.sql   struttura dello schema public (tabelle, regole di accesso, funzioni)
  3_dati.sql        dati degli schemi public, auth e storage
  4_file/           tutti i file dei bucket di Storage
  COMPLETATO        indicatore di copia riuscita, con l'esito
Accesso al database con il ruolo temporaneo della Supabase CLI rilasciato dalla Management API (5 minuti; lo script legge soltanto); credenziali
lette dal portachiavi (token della Supabase CLI) e mai scritte su disco. Tiene le ultime CONSERVA copie riuscite.
"""
import base64, datetime, json, os, shutil, subprocess, sys, urllib.parse, urllib.request

REF = 'vwbixmbbcutjcplskjvg'
POOLER = 'aws-1-eu-central-1.pooler.supabase.com'
PG_DUMP = '/opt/homebrew/opt/postgresql@17/bin/pg_dump'
RADICE = os.path.expanduser('~/Backup-pmi360')
CONSERVA = 30
BASE = f'https://{REF}.supabase.co'


def notifica(titolo, testo):
    testo = testo.replace('"', "'")
    subprocess.run(['osascript', '-e', f'display notification "{testo}" with title "{titolo}"'], check=False)


def token_cli():
    t = subprocess.run(['security', 'find-generic-password', '-s', 'Supabase CLI', '-w'], capture_output=True, text=True).stdout.strip()
    if t.startswith('go-keyring-base64:'):
        t = base64.b64decode(t.split(':', 1)[1]).decode()
    if not t:
        raise RuntimeError('token della Supabase CLI non trovato nel portachiavi (esegui "supabase login")')
    return t


def http(metodo, url, headers, corpo=None, timeout=120):
    r = urllib.request.Request(url, method=metodo, headers=headers, data=corpo)
    with urllib.request.urlopen(r, timeout=timeout) as x:
        return x.read()


def gia_fatto_oggi():
    oggi = datetime.date.today().isoformat()
    if not os.path.isdir(RADICE):
        return False
    return any(d.startswith(oggi) and os.path.exists(os.path.join(RADICE, d, 'COMPLETATO')) for d in os.listdir(RADICE))


def rete_disponibile():
    try:
        http('GET', 'https://api.supabase.com/v1', {}, timeout=10)
        return True
    except urllib.error.HTTPError:
        return True  # risponde: la rete c'e'
    except Exception:
        return False


def pg_dump(ruolo, args, destinazione):
    env = {**os.environ, 'PGPASSWORD': ruolo['password'], 'PGSSLMODE': 'require'}
    cmd = [PG_DUMP, '-h', POOLER, '-p', '5432', '-U', f"{ruolo['role']}.{REF}", '-d', 'postgres', '--role', 'postgres', '--no-owner', '--no-privileges', '-f', destinazione] + args
    r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'pg_dump: {r.stderr.strip()[:300]}')
    os.chmod(destinazione, 0o600)


def scarica_file(chiave_servizio, cartella):
    H = {'apikey': chiave_servizio, 'Authorization': 'Bearer ' + chiave_servizio}
    totale, byte = 0, 0

    def elenca(bucket, prefisso=''):
        out, off = [], 0
        while True:
            corpo = json.dumps({'prefix': prefisso, 'limit': 1000, 'offset': off}).encode()
            voci = json.loads(http('POST', f'{BASE}/storage/v1/object/list/{bucket}', {**H, 'Content-Type': 'application/json'}, corpo))
            for v in voci:
                percorso = f"{prefisso}{v['name']}"
                out += elenca(bucket, percorso + '/') if v.get('id') is None else [percorso]
            if len(voci) < 1000:
                return out
            off += 1000

    for b in json.loads(http('GET', f'{BASE}/storage/v1/bucket', H)):
        for p in elenca(b['id']):
            dati = http('GET', f"{BASE}/storage/v1/object/{b['id']}/" + urllib.parse.quote(p), H)
            dest = os.path.join(cartella, b['id'], p)
            os.makedirs(os.path.dirname(dest), mode=0o700, exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(dati)
            os.chmod(dest, 0o600)
            totale += 1
            byte += len(dati)
    return totale, byte


def pulizia():
    riuscite = sorted(d for d in os.listdir(RADICE) if os.path.exists(os.path.join(RADICE, d, 'COMPLETATO')))
    for d in riuscite[:-CONSERVA]:
        shutil.rmtree(os.path.join(RADICE, d), ignore_errors=True)
    # copie non completate di giorni passati (es. Mac spento a meta')
    oggi = datetime.date.today().isoformat()
    for d in os.listdir(RADICE):
        p = os.path.join(RADICE, d)
        if os.path.isdir(p) and not d.startswith(oggi) and d[:4].isdigit() and not os.path.exists(os.path.join(p, 'COMPLETATO')):
            shutil.rmtree(p, ignore_errors=True)


def main():
    os.umask(0o077)  # copie leggibili solo dall'utente
    os.makedirs(RADICE, mode=0o700, exist_ok=True)
    if gia_fatto_oggi() and '--forza' not in sys.argv:
        print(f'{datetime.datetime.now():%Y-%m-%d %H:%M} copia di oggi gia presente')
        return 0
    if not rete_disponibile():
        print(f'{datetime.datetime.now():%Y-%m-%d %H:%M} rete non disponibile, riprovo tra un\'ora')
        return 0
    cartella = os.path.join(RADICE, datetime.datetime.now().strftime('%Y-%m-%d_%H%M'))
    os.makedirs(cartella, mode=0o700, exist_ok=True)
    try:
        tk = token_cli()
        M = {'Authorization': 'Bearer ' + tk, 'Content-Type': 'application/json'}
        ruolo = json.loads(http('POST', f'https://api.supabase.com/v1/projects/{REF}/cli/login-role', M, b'{"read_only": false}'))
        pg_dump(ruolo, ['--schema-only', '-n', 'public'], os.path.join(cartella, '2_struttura.sql'))
        pg_dump(ruolo, ['--data-only', '-n', 'public', '-n', 'auth', '-n', 'storage'], os.path.join(cartella, '3_dati.sql'))
        chiavi = json.loads(http('GET', f'https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true', M))
        servizio = {k['name']: k['api_key'] for k in chiavi}['service_role']
        n, byte = scarica_file(servizio, os.path.join(cartella, '4_file'))
        mb = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(cartella) for f in fs) / 1e6
        esito = f'{datetime.datetime.now():%Y-%m-%d %H:%M} copia riuscita: database + {n} file, {mb:.1f} MB'
        with open(os.path.join(cartella, 'COMPLETATO'), 'w') as f:
            f.write(esito + '\n')
        pulizia()
        print(esito)
        notifica('Backup Pmi 360°', f'Copia di oggi riuscita ({n} file, {mb:.0f} MB)')
        return 0
    except Exception as e:
        print(f'{datetime.datetime.now():%Y-%m-%d %H:%M} ERRORE: {e}')
        notifica('Backup Pmi 360° NON riuscito', f'{str(e)[:120]} - riprovo tra un\'ora')
        return 1


if __name__ == '__main__':
    sys.exit(main())
