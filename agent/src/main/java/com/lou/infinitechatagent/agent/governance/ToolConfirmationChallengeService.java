package com.lou.infinitechatagent.agent.governance;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 高风险工具「用户确认」挑战令牌服务(F01)。
 *
 * <p><b>问题</b>:旧实现里放行只看请求体自带的 {@code confirmedTools.contains(toolName)}——任何客户端
 * 把工具名塞进去即可绕过(无状态、可伪造)。
 *
 * <p><b>方案</b>:首次命中高风险工具时,服务端生成一次性 <b>challenge token</b>(绑定
 * {@code userId / sessionId / 动作指纹(toolName)} + TTL),返回给客户端;客户端二次请求必须回传
 * <b>该 token</b>(而非工具名),服务端校验指纹一致后 <b>一次性消费</b>(立即失效)才放行。令牌不可被
 * 客户端伪造(服务端随机生成、服务端存储)。
 *
 * <p><b>存储与降级</b>:首选 Redis(跨实例、随重启 TTL 自然过期);Redis bean 缺失或运行期异常时,
 * 按 {@code agent.tool-governance.challenge.fail-closed-on-store-error} 二选一:
 * <ul>
 *   <li>{@code false}(默认):<b>降级到进程内内存存储</b>(带 TTL 与容量上限)。仍保持「服务端生成 +
 *       一次性消费」的不可伪造性;代价是<b>单实例</b>语义(A 实例签发的令牌不能在 B 实例消费),多实例
 *       生产部署必须接 Redis。与本工程既有「本地优雅降级」一致。</li>
 *   <li>{@code true}:<b>fail-closed</b>——存储不可用时拒绝签发/消费(高风险工具暂不可用),安全优先。</li>
 * </ul>
 */
@Service
@Slf4j
public class ToolConfirmationChallengeService {

    private static final String REDIS_KEY_PREFIX = "agent:tool-challenge:";
    private static final int MAX_IN_MEMORY_ENTRIES = 10_000;

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    @Value("${agent.tool-governance.challenge.ttl-seconds:300}")
    private long ttlSeconds;

    @Value("${agent.tool-governance.challenge.fail-closed-on-store-error:false}")
    private boolean failClosedOnStoreError;

    private final SecureRandom secureRandom = new SecureRandom();

    /** 进程内兜底存储:token → (fingerprint, expiryEpochMs)。 */
    private final Map<String, InMemoryEntry> inMemoryStore = new ConcurrentHashMap<>();

    public ToolConfirmationChallengeService(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    /**
     * 签发一次性 challenge token,绑定到 {@code (userId, sessionId, toolName)} 指纹,TTL 内有效。
     *
     * @return 令牌字符串;若 fail-closed 且存储不可用则返回 {@code null}(调用方据此拒绝)。
     */
    public String issueChallenge(Long userId, Long sessionId, String toolName) {
        String token = newToken();
        String fingerprint = fingerprint(userId, sessionId, toolName);
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                redis.opsForValue().set(REDIS_KEY_PREFIX + token, fingerprint, Duration.ofSeconds(ttlSeconds));
                return token;
            } catch (RuntimeException e) {
                if (failClosedOnStoreError) {
                    log.error("[tool-challenge] Redis 签发失败且 fail-closed,拒绝签发: {}", e.getMessage());
                    return null;
                }
                log.warn("[tool-challenge] Redis 签发失败,降级内存存储(单实例语义): {}", e.getMessage());
            }
        } else if (failClosedOnStoreError) {
            log.error("[tool-challenge] 无 Redis 且 fail-closed,拒绝签发高风险工具确认令牌");
            return null;
        }
        putInMemory(token, fingerprint);
        return token;
    }

    /**
     * 校验并 <b>一次性消费</b> token:存在 + 指纹匹配 {@code (userId, sessionId, toolName)} 才返回 true,
     * 随即从存储删除(不可重放)。指纹不符或不存在/已过期/已消费 → false。
     */
    public boolean consume(String token, Long userId, Long sessionId, String toolName) {
        if (token == null || token.isBlank()) {
            return false;
        }
        String expected = fingerprint(userId, sessionId, toolName);
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                String key = REDIS_KEY_PREFIX + token;
                String stored = redis.opsForValue().get(key);
                if (stored == null) {
                    // Redis 里没有——可能是降级期写进了内存,继续查内存兜底。
                    return consumeInMemory(token, expected);
                }
                boolean match = stored.equals(expected);
                redis.delete(key); // 一次性:无论匹配与否都消费,避免被探测/重放。
                return match;
            } catch (RuntimeException e) {
                if (failClosedOnStoreError) {
                    log.error("[tool-challenge] Redis 校验失败且 fail-closed,拒绝放行: {}", e.getMessage());
                    return false;
                }
                log.warn("[tool-challenge] Redis 校验失败,降级查内存存储: {}", e.getMessage());
            }
        }
        return consumeInMemory(token, expected);
    }

    public long getTtlSeconds() {
        return ttlSeconds;
    }

    private boolean consumeInMemory(String token, String expectedFingerprint) {
        InMemoryEntry entry = inMemoryStore.remove(token); // 一次性
        if (entry == null) {
            return false;
        }
        if (entry.expiryEpochMs < System.currentTimeMillis()) {
            return false;
        }
        return entry.fingerprint.equals(expectedFingerprint);
    }

    private void putInMemory(String token, String fingerprint) {
        if (inMemoryStore.size() >= MAX_IN_MEMORY_ENTRIES) {
            evictExpired();
        }
        inMemoryStore.put(token, new InMemoryEntry(fingerprint, System.currentTimeMillis() + ttlSeconds * 1000L));
    }

    private void evictExpired() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, InMemoryEntry>> it = inMemoryStore.entrySet().iterator();
        while (it.hasNext()) {
            if (it.next().getValue().expiryEpochMs < now) {
                it.remove();
            }
        }
    }

    private String fingerprint(Long userId, Long sessionId, String toolName) {
        return (userId == null ? "-" : userId)
                + "|" + (sessionId == null ? "-" : sessionId)
                + "|" + (StringUtils.hasText(toolName) ? toolName : "-");
    }

    private String newToken() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private record InMemoryEntry(String fingerprint, long expiryEpochMs) {
    }
}
