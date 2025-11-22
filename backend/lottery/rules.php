<?php
// backend/lottery/rules.php

if (!function_exists('get_lottery_rules')) {
    function get_lottery_rules() {
        // 静态规则表：包含波色和生肖
        // 注意：生肖通常每年会变，这里使用的是原始文档中的固定映射
        // 01=蛇, 02=龙... 49=蛇 (根据原始文档恢复)
        static $rules = null;
        if ($rules === null) {
            $rules = [
                '01' => ['color' => '红波', 'zodiac' => '蛇'], '02' => ['color' => '红波', 'zodiac' => '龙'],
                '03' => ['color' => '蓝波', 'zodiac' => '兔'], '04' => ['color' => '蓝波', 'zodiac' => '虎'],
                '05' => ['color' => '绿波', 'zodiac' => '牛'], '06' => ['color' => '绿波', 'zodiac' => '鼠'],
                '07' => ['color' => '红波', 'zodiac' => '猪'], '08' => ['color' => '红波', 'zodiac' => '狗'],
                '09' => ['color' => '蓝波', 'zodiac' => '鸡'], '10' => ['color' => '蓝波', 'zodiac' => '猴'],
                '11' => ['color' => '绿波', 'zodiac' => '羊'], '12' => ['color' => '红波', 'zodiac' => '马'],
                '13' => ['color' => '红波', 'zodiac' => '蛇'], '14' => ['color' => '蓝波', 'zodiac' => '龙'],
                '15' => ['color' => '蓝波', 'zodiac' => '兔'], '16' => ['color' => '绿波', 'zodiac' => '虎'],
                '17' => ['color' => '绿波', 'zodiac' => '牛'], '18' => ['color' => '红波', 'zodiac' => '鼠'],
                '19' => ['color' => '红波', 'zodiac' => '猪'], '20' => ['color' => '蓝波', 'zodiac' => '狗'],
                '21' => ['color' => '绿波', 'zodiac' => '鸡'], '22' => ['color' => '绿波', 'zodiac' => '猴'],
                '23' => ['color' => '红波', 'zodiac' => '羊'], '24' => ['color' => '红波', 'zodiac' => '马'],
                '25' => ['color' => '蓝波', 'zodiac' => '蛇'], '26' => ['color' => '蓝波', 'zodiac' => '龙'],
                '27' => ['color' => '绿波', 'zodiac' => '兔'], '28' => ['color' => '绿波', 'zodiac' => '虎'],
                '29' => ['color' => '红波', 'zodiac' => '牛'], '30' => ['color' => '红波', 'zodiac' => '鼠'],
                '31' => ['color' => '蓝波', 'zodiac' => '猪'], '32' => ['color' => '绿波', 'zodiac' => '狗'],
                '33' => ['color' => '绿波', 'zodiac' => '鸡'], '34' => ['color' => '红波', 'zodiac' => '猴'],
                '35' => ['color' => '红波', 'zodiac' => '羊'], '36' => ['color' => '蓝波', 'zodiac' => '马'],
                '37' => ['color' => '蓝波', 'zodiac' => '蛇'], '38' => ['color' => '绿波', 'zodiac' => '龙'],
                '39' => ['color' => '绿波', 'zodiac' => '兔'], '40' => ['color' => '红波', 'zodiac' => '虎'],
                '41' => ['color' => '蓝波', 'zodiac' => '牛'], '42' => ['color' => '蓝波', 'zodiac' => '鼠'],
                '43' => ['color' => '绿波', 'zodiac' => '猪'], '44' => ['color' => '绿波', 'zodiac' => '狗'],
                '45' => ['color' => '红波', 'zodiac' => '鸡'], '46' => ['color' => '红波', 'zodiac' => '猴'],
                '47' => ['color' => '蓝波', 'zodiac' => '羊'], '48' => ['color' => '蓝波', 'zodiac' => '马'],
                '49' => ['color' => '绿波', 'zodiac' => '蛇']
            ];
        }
        return $rules;
    }

    function get_color_by_number($num) {
        $rules = get_lottery_rules();
        $key = str_pad($num, 2, '0', STR_PAD_LEFT);
        return $rules[$key]['color'] ?? '未知';
    }

    function get_zodiac_by_number($num) {
        $rules = get_lottery_rules();
        $key = str_pad($num, 2, '0', STR_PAD_LEFT);
        return $rules[$key]['zodiac'] ?? '未知';
    }
}
?>