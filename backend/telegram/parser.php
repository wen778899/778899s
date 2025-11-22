<?php
// backend/telegram/parser.php

// 引入规则库
require_once __DIR__ . '/../lottery/rules.php';

function parse_channel_post($text) {
    $text = trim($text);
    
    $data = [
        'lottery_type' => '',
        'issue_number' => '',
        'winning_numbers' => [],
        'zodiac_signs' => [],
        'colors' => [],
        'drawing_date' => date('Y-m-d')
    ];

    // 1. 识别彩票类型和期号
    if (preg_match('/(新澳门|老澳门|香港).*?(\d+)[期]?/u', $text, $matches)) {
        if (strpos($matches[1], '新澳门') !== false) $data['lottery_type'] = '新澳门六合彩';
        elseif (strpos($matches[1], '老澳门') !== false) $data['lottery_type'] = '老澳门六合彩';
        elseif (strpos($matches[1], '香港') !== false) $data['lottery_type'] = '香港六合彩';
        
        $data['issue_number'] = $matches[2];
    } else {
        return null;
    }

    // 2. 提取数字 (必须找满7个)
    preg_match_all('/\b\d{2}\b/', $text, $num_matches);
    if (isset($num_matches[0]) && count($num_matches[0]) >= 7) {
        $data['winning_numbers'] = array_slice($num_matches[0], 0, 7);
    } else {
        return null;
    }

    // 3. 【核心修改】使用规则库自动生成波色和生肖
    // 不再依赖 OCR 识别 Emoji，因为规则库更准
    foreach ($data['winning_numbers'] as $num) {
        if (function_exists('get_color_by_number')) {
            $data['colors'][] = get_color_by_number($num);
            $data['zodiac_signs'][] = get_zodiac_by_number($num);
        } else {
            $data['colors'][] = '未知';
            $data['zodiac_signs'][] = '未知';
        }
    }

    return $data;
}
?>