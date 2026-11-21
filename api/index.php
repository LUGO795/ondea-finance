<?php
/* ==========================================================================
   Ondea Finance — API REST (PHP 8 / PDO) compatible avec js/core/drivers.js
   --------------------------------------------------------------------------
   GET    ?entity=transactions            → liste
   POST   ?entity=transactions            → création (corps JSON)
   PUT    ?entity=transactions&id=…       → mise à jour (corps JSON complet)
   DELETE ?entity=transactions&id=…       → suppression
   GET|PUT ?entity=settings               → paramètres de l'entreprise
   GET|POST ?entity=meta                  → indicateur d'initialisation
   POST   ?action=restore | ?action=clear → restauration / effacement
   Fichiers : ?entity=files (multipart « meta » + « file »), &raw=1 pour le binaire
   Réponses : { "data": … } ou { "error": "…" }
   ========================================================================== */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
session_start();

$config = require __DIR__ . '/config.php';

/* ---- Modèle : entités autorisées et colonnes (camelCase côté JS) ---- */
const COMMON = ['id', 'createdAt', 'updatedAt'];
const ENTITIES = [
    'accounts'       => ['accounts',        ['name', 'bank', 'iban', 'openingBalance', 'color']],
    'categories'     => ['categories',      ['name', 'type', 'color', 'icon', 'neutral', 'system']],
    'thirdParties'   => ['third_parties',   ['kind', 'name', 'siret', 'email', 'phone', 'address', 'city', 'paymentTerms', 'notes']],
    'paymentMethods' => ['payment_methods', ['name', 'kind', 'accountId']],
    'transactions'   => ['transactions',    ['type', 'date', 'label', 'amountHT', 'amountVAT', 'amountTTC', 'vatRate', 'base', 'status', 'categoryId', 'thirdPartyId', 'paymentMethodId', 'accountId', 'reference', 'notes', 'attachments', 'invoiceId', 'scheduleId']],
    'invoices'       => ['invoices',        ['direction', 'number', 'thirdPartyId', 'categoryId', 'label', 'issueDate', 'dueDate', 'amountHT', 'amountVAT', 'amountTTC', 'vatRate', 'status', 'paidDate', 'transactionId', 'attachments', 'notes']],
    'schedules'      => ['schedules',       ['type', 'label', 'frequency', 'nextDate', 'endDate', 'amountHT', 'amountVAT', 'amountTTC', 'vatRate', 'categoryId', 'thirdPartyId', 'accountId', 'paymentMethodId', 'active']],
    'budgets'        => ['budgets',         ['categoryId', 'period', 'amount', 'alert']],
    'transfers'      => ['transfers',       ['date', 'fromId', 'toId', 'amount', 'label']],
];
/* Ordre d'insertion respectant les clés étrangères */
const ORDER = ['accounts', 'categories', 'thirdParties', 'paymentMethods', 'transactions', 'invoices', 'schedules', 'budgets', 'transfers'];
const JSON_FIELDS = ['attachments', 'tags'];
const BOOL_FIELDS = ['neutral', 'active'];
const INT_FIELDS = ['openingBalance', 'paymentTerms', 'amountHT', 'amountVAT', 'amountTTC', 'amount'];
const FLOAT_FIELDS = ['vatRate', 'alert'];
const NULLABLE_DATES = ['paidDate'];

function reply($data, int $code = 200)
{
    http_response_code($code);
    echo json_encode($code < 400 ? ['data' => $data] : ['error' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}
function snake(string $s): string { return strtolower(preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $s)); }
function col(string $f): string { $c = snake($f); return $c === 'system' ? '`system`' : $c; }
function body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (!is_array($data)) reply('Corps JSON invalide.', 400);
    return $data;
}
function toRow(string $entity, array $rec): array
{
    $row = [];
    foreach (array_merge(COMMON, ENTITIES[$entity][1]) as $f) {
        $v = $rec[$f] ?? null;
        if (in_array($f, JSON_FIELDS, true)) $v = json_encode(is_array($v) ? array_values($v) : [], JSON_UNESCAPED_UNICODE);
        elseif (in_array($f, BOOL_FIELDS, true)) $v = $v ? 1 : 0;
        elseif (in_array($f, INT_FIELDS, true)) $v = (int) round((float) ($v ?? 0));
        elseif (in_array($f, FLOAT_FIELDS, true)) $v = (float) ($v ?? 0);
        elseif (in_array($f, NULLABLE_DATES, true) && ($v === '' || $v === null)) $v = null;
        elseif (is_string($v)) $v = mb_substr($v, 0, 2000);
        $row[$f] = $v;
    }
    if (!is_string($row['id']) || !preg_match('/^[A-Za-z0-9_\-]{1,40}$/', $row['id'])) reply('Identifiant invalide.', 422);
    return $row;
}
function fromRow(string $entity, array $row): array
{
    $out = [];
    foreach (array_merge(COMMON, ENTITIES[$entity][1]) as $f) {
        $v = $row[trim(col($f), '`')] ?? null;
        if (in_array($f, JSON_FIELDS, true)) $v = $v ? json_decode((string) $v, true) : [];
        elseif (in_array($f, BOOL_FIELDS, true)) $v = (bool) $v;
        elseif (in_array($f, INT_FIELDS, true)) $v = (int) $v;
        elseif (in_array($f, FLOAT_FIELDS, true)) $v = (float) $v;
        $out[$f] = $v;
    }
    return $out;
}

try {
    $pdo = new PDO($config['dsn'], $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    reply('Connexion à la base impossible.', 500);
}

/* ---- Contexte utilisateur / entreprise ---- */
if (!$config['single_company_mode'] && empty($_SESSION['user_id'])) reply('Authentification requise.', 401);
$company = (int) ($_SESSION['company_id'] ?? 1);

$method = $_SERVER['REQUEST_METHOD'];
$entity = $_GET['entity'] ?? '';
$id = isset($_GET['id']) ? (string) $_GET['id'] : null;
$action = $_GET['action'] ?? '';

/* Protection CSRF minimale : exiger un appel same-origin pour les écritures */
if ($method !== 'GET' && isset($_SERVER['HTTP_ORIGIN'])) {
    $host = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    if ($host !== ($_SERVER['SERVER_NAME'] ?? $host)) reply('Origine refusée.', 403);
}

try {
    /* ---------- Actions globales ---------- */
    if ($action === 'restore' || $action === 'clear') {
        $data = $action === 'restore' ? body() : [];
        $pdo->beginTransaction();
        foreach (array_reverse(ORDER) as $e) {
            $pdo->prepare('DELETE FROM ' . ENTITIES[$e][0] . ' WHERE company_id = ?')->execute([$company]);
        }
        if ($action === 'restore') {
            foreach (ORDER as $e) {
                $fields = array_merge(COMMON, ENTITIES[$e][1]);
                $sql = 'INSERT INTO ' . ENTITIES[$e][0] . ' (company_id, ' . implode(', ', array_map('col', $fields)) . ') VALUES (?' . str_repeat(', ?', count($fields)) . ')';
                $st = $pdo->prepare($sql);
                foreach (($data[$e] ?? []) as $rec) $st->execute(array_merge([$company], array_values(toRow($e, $rec))));
            }
        }
        $pdo->commit();
        reply(true);
    }
    if ($action === 'clear-files') {
        foreach ($pdo->query('SELECT storage_path FROM files WHERE company_id = ' . $company) as $f) @unlink($config['storage'] . '/' . basename($f['storage_path']));
        $pdo->prepare('DELETE FROM files WHERE company_id = ?')->execute([$company]);
        reply(true);
    }

    /* ---------- Paramètres & méta ---------- */
    if ($entity === 'settings' || $entity === 'meta') {
        $st = $pdo->prepare('SELECT data, initialized FROM settings WHERE company_id = ?');
        $st->execute([$company]);
        $row = $st->fetch() ?: ['data' => '{}', 'initialized' => 0];
        if ($method === 'GET') reply($entity === 'meta' ? ['initialized' => (bool) $row['initialized']] : json_decode((string) $row['data'], true));
        $sql = $entity === 'meta'
            ? 'INSERT INTO settings (company_id, data, initialized) VALUES (?, \'{}\', 1) ON DUPLICATE KEY UPDATE initialized = 1'
            : 'INSERT INTO settings (company_id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)';
        $params = $entity === 'meta' ? [$company] : [$company, json_encode(body(), JSON_UNESCAPED_UNICODE)];
        $pdo->prepare($sql)->execute($params);
        reply(true);
    }

    /* ---------- Fichiers (justificatifs) ---------- */
    if ($entity === 'files') {
        $dir = $config['storage'];
        if (!is_dir($dir)) mkdir($dir, 0750, true);
        if ($method === 'GET' && $id === null) {
            $st = $pdo->prepare('SELECT id, name, type, size, folder, tags, note, created_at FROM files WHERE company_id = ? ORDER BY created_at DESC');
            $st->execute([$company]);
            reply(array_map(fn($r) => ['id' => $r['id'], 'name' => $r['name'], 'type' => $r['type'], 'size' => (int) $r['size'], 'folder' => $r['folder'], 'tags' => json_decode((string) $r['tags'], true) ?: [], 'note' => $r['note'], 'createdAt' => $r['created_at']], $st->fetchAll()));
        }
        $st = $pdo->prepare('SELECT * FROM files WHERE company_id = ? AND id = ?');
        $st->execute([$company, $id]);
        $file = $st->fetch();
        if ($method === 'GET') {
            if (!$file) reply('Fichier introuvable.', 404);
            if (!empty($_GET['raw'])) {
                header('Content-Type: ' . $file['type']);
                header('Content-Disposition: inline; filename="' . rawurlencode($file['name']) . '"');
                readfile($dir . '/' . basename($file['storage_path']));
                exit;
            }
            reply(['id' => $file['id'], 'name' => $file['name'], 'type' => $file['type'], 'size' => (int) $file['size'], 'folder' => $file['folder'], 'tags' => json_decode((string) $file['tags'], true) ?: [], 'note' => $file['note'], 'createdAt' => $file['created_at']]);
        }
        if ($method === 'POST') {
            $meta = json_decode($_POST['meta'] ?? '', true);
            $up = $_FILES['file'] ?? null;
            if (!is_array($meta) || !$up || $up['error'] !== UPLOAD_ERR_OK) reply('Envoi de fichier invalide.', 400);
            if ($up['size'] > $config['max_upload']) reply('Fichier trop volumineux.', 413);
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($up['tmp_name']) ?: 'application/octet-stream';
            if (!preg_match('#^(image/|application/pdf|text/|application/(json|xml|zip|msword|vnd\.))#', $mime)) reply('Type de fichier refusé.', 415);
            $fid = preg_replace('/[^A-Za-z0-9_\-]/', '', (string) ($meta['id'] ?? '')) ?: bin2hex(random_bytes(8));
            $stored = $company . '_' . $fid . '.bin';
            move_uploaded_file($up['tmp_name'], $dir . '/' . $stored);
            $pdo->prepare('REPLACE INTO files (id, company_id, name, type, size, folder, tags, note, storage_path, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
                ->execute([$fid, $company, mb_substr((string) $meta['name'], 0, 160), $mime, (int) $up['size'], (string) ($meta['folder'] ?? 'justificatifs'), json_encode($meta['tags'] ?? []), (string) ($meta['note'] ?? ''), $stored, (string) ($meta['createdAt'] ?? date('c'))]);
            reply(true, 201);
        }
        if (!$file) reply('Fichier introuvable.', 404);
        if ($method === 'PUT') {
            $p = body();
            $pdo->prepare('UPDATE files SET name = ?, folder = ?, tags = ?, note = ? WHERE company_id = ? AND id = ?')
                ->execute([mb_substr((string) ($p['name'] ?? $file['name']), 0, 160), (string) ($p['folder'] ?? $file['folder']), json_encode($p['tags'] ?? json_decode((string) $file['tags'], true) ?? []), (string) ($p['note'] ?? $file['note']), $company, $id]);
            reply(['id' => $id, 'name' => $p['name'] ?? $file['name'], 'type' => $file['type'], 'size' => (int) $file['size'], 'folder' => $p['folder'] ?? $file['folder'], 'tags' => $p['tags'] ?? [], 'note' => $p['note'] ?? $file['note'], 'createdAt' => $file['created_at']]);
        }
        if ($method === 'DELETE') {
            @unlink($dir . '/' . basename($file['storage_path']));
            $pdo->prepare('DELETE FROM files WHERE company_id = ? AND id = ?')->execute([$company, $id]);
            reply(true);
        }
        reply('Méthode non prise en charge.', 405);
    }

    /* ---------- CRUD générique ---------- */
    if (!isset(ENTITIES[$entity])) reply('Entité inconnue.', 404);
    [$table, $cols] = ENTITIES[$entity];
    $fields = array_merge(COMMON, $cols);

    switch ($method) {
        case 'GET':
            $st = $pdo->prepare("SELECT * FROM $table WHERE company_id = ?");
            $st->execute([$company]);
            reply(array_map(fn($r) => fromRow($entity, $r), $st->fetchAll()));
        case 'POST':
            $row = toRow($entity, body());
            $sql = "INSERT INTO $table (company_id, " . implode(', ', array_map('col', $fields)) . ') VALUES (?' . str_repeat(', ?', count($fields)) . ')';
            $pdo->prepare($sql)->execute(array_merge([$company], array_values($row)));
            reply(fromRow($entity, array_combine(array_map(fn($f) => trim(col($f), '`'), $fields), array_values($row))), 201);
        case 'PUT':
            if ($id === null) reply('Identifiant manquant.', 400);
            $row = toRow($entity, array_merge(body(), ['id' => $id]));
            unset($row['id'], $row['createdAt']);
            $sets = implode(', ', array_map(fn($f) => col($f) . ' = ?', array_keys($row)));
            $st = $pdo->prepare("UPDATE $table SET $sets WHERE company_id = ? AND id = ?");
            $st->execute(array_merge(array_values($row), [$company, $id]));
            $g = $pdo->prepare("SELECT * FROM $table WHERE company_id = ? AND id = ?");
            $g->execute([$company, $id]);
            $r = $g->fetch();
            if (!$r) reply('Élément introuvable.', 404);
            reply(fromRow($entity, $r));
        case 'DELETE':
            if ($id === null) reply('Identifiant manquant.', 400);
            $pdo->prepare("DELETE FROM $table WHERE company_id = ? AND id = ?")->execute([$company, $id]);
            reply(true);
        default:
            reply('Méthode non prise en charge.', 405);
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $msg = str_contains($e->getMessage(), 'foreign key') ? 'Opération refusée : cet élément est référencé ailleurs.' : 'Erreur de base de données.';
    reply($msg, 409);
}
