<?php
require_once 'BaseController.php';
require_once 'gameLogic.php'; // 游戏核心逻辑

class GameController extends BaseController {

    // 发牌
    public function deal() {
        // 这部分可以保持不变，因为它不直接依赖用户状态
        $deck = createDeck();
        shuffle($deck);
        $hand = array_slice($deck, 0, 13);
        
        // 简单地将牌局信息存在Session或一个临时存储中
        session_start();
        $_SESSION['shuffled_deck'] = $deck;

        // 注意：为了简化，我们暂时不为每局游戏创建唯一ID并持久化到数据库
        // 在一个真实的多人应用中，您需要将 cpu_hand 等信息与 game_id 关联并存储

        return ['success' => true, 'hand' => $hand];
    }

    // 对比手牌
    public function compareManual($data) {
        session_start();
        $user = $this->getAuthenticatedUser();
        if (!$user) {
            http_response_code(401);
            return ['success' => false, 'message' => '请先登录后再开始游戏。'];
        }

        if (!isset($data['playerSorted']) || !isset($_SESSION['shuffled_deck'])) {
            return ['success' => false, 'message' => '无效的请求或游戏会话已过期。'];
        }

        $playerSorted = $data['playerSorted'];
        $deck = $_SESSION['shuffled_deck'];

        // 从牌堆中移除玩家手牌，剩下的作为CPU手牌
        $playerHandValues = array_map(fn($c) => $c['value'] . $c['suit'], array_merge($playerSorted['front']['cards'], $playerSorted['middle']['cards'], $playerSorted['back']['cards']));
        $cpuDeck = array_filter($deck, fn($c) => !in_array($c['value'] . $c['suit'], $playerHandValues));
        $cpuHand = array_slice($cpuDeck, 0, 13);
        
        $cpuSorted = getBestHandCombination($cpuHand);

        $results = compareAllHands($playerSorted, $cpuSorted);

        $winner = ($results['total'] > 0) ? 'Player' : 'CPU';

        // 将游戏结果和积分变化保存到数据库
        try {
            $this->pdo->beginTransaction();
            
            // 更新用户积分
            $stmt = $this->pdo->prepare("UPDATE users SET points = points + ? WHERE id = ?");
            $stmt->execute([$results['total'], $user['id']]);
            
            // (可选) 记录游戏对局详情
            // 在这里您可以将 $playerSorted, $cpuSorted, $results 等信息序列化后存入 game_records 表
            
            $this->pdo->commit();

        } catch(Exception $e) {
            $this->pdo->rollBack();
            // 即使数据库操作失败，也返回游戏结果，但提示错误
            return ['success' => false, 'message' => '无法保存积分，请联系管理员', 'error' => $e->getMessage()];
        }

        unset($_SESSION['shuffled_deck']); // 清理会话
        
        return [
            'success' => true, 
            'winner' => $winner,
            'results' => $results, 
            'cpuSorted' => $cpuSorted
        ];
    }
}
