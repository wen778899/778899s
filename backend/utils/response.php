<?php
function json_response($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}

function json_error($message, $statusCode = 400) {
    json_response(['error' => $message], $statusCode);
}