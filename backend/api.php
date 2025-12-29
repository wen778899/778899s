<?php
// --- START CORS CONFIGURATION ---

// Allow requests from any origin. For a production environment, you might want to
// replace '*' with your specific frontend domain, e.g., 'https://yourapp.com'.
// For hybrid apps (APK), '*' is often the safest choice.
header("Access-Control-Allow-Origin: *");

// Allow the HTTP methods that your API uses.
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");

// Allow specific headers that the client might send.
// 'Content-Type' is needed for POST requests with a JSON body.
// 'Authorization' is needed for sending the JWT token.
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle the browser's preflight 'OPTIONS' request.
// This is a check flight that the browser sends before the actual request.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    // A 200 OK response is all that's needed for a successful preflight.
    http_response_code(200);
    // Stop the script from executing further.
    exit;
}

// --- END CORS CONFIGURATION ---


require_once 'config.php';
require_once 'UserController.php';
require_once 'GameController.php';

header('Content-Type: application/json');

// Parse the request URI
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
// Remove the base path part if your API is in a subdirectory
$api_base = '/backend/api.php';
if (strpos($path, $api_base) === 0) {
    $path = substr($path, strlen($api_base));
}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true);

$response = [];

switch ($path) {
    // --- User Routes ---
    case '/user/register':
        $controller = new UserController();
        $response = $controller->register($data);
        break;
    case '/user/login':
        $controller = new UserController();
        $response = $controller->login($data);
        break;
    case '/user/me':
        $controller = new UserController();
        $response = $controller->getCurrentUser();
        break;
    case '/user/search':
        $controller = new UserController();
        $response = $controller->searchUser($data);
        break;
    case '/user/transfer':
        $controller = new UserController();
        $response = $controller->transferPoints($data);
        break;

    // --- Game Routes ---
    case '/game/deal':
        $controller = new GameController();
        $response = $controller->deal();
        break;
    case '/game/compare':
        $controller = new GameController();
        $response = $controller->compareManual($data);
        break;

    default:
        http_response_code(404);
        $response = ['success' => false, 'message' => 'API endpoint not found'];
        break;
}

echo json_encode($response);
