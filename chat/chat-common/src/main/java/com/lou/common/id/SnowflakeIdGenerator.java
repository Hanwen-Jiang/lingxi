package com.lou.common.id;

import java.net.InetAddress;

/**
 * Snowflake ID 生成器(D9:workerId/datacenterId 按实例派生,避免横向扩容主键碰撞)。
 * <p>布局:符号位 + 41 位时间戳 + 5 位 datacenterId + 5 位 workerId + 12 位序列。
 * worker/datacenter 优先取环境变量 {@code WORKER_ID}/{@code DATACENTER_ID}(或同名系统属性),
 * 否则由 hostname 哈希派生——使不同实例天然不同。
 */
public final class SnowflakeIdGenerator {

    /** 自定义纪元 2023-11-14T22:13:20Z。 */
    private static final long EPOCH = 1700000000000L;
    private static final long WORKER_BITS = 5L;
    private static final long DC_BITS = 5L;
    private static final long SEQ_BITS = 12L;
    private static final long MAX_WORKER = ~(-1L << WORKER_BITS);
    private static final long MAX_DC = ~(-1L << DC_BITS);
    private static final long SEQ_MASK = ~(-1L << SEQ_BITS);
    private static final long WORKER_SHIFT = SEQ_BITS;
    private static final long DC_SHIFT = SEQ_BITS + WORKER_BITS;
    private static final long TS_SHIFT = SEQ_BITS + WORKER_BITS + DC_BITS;

    private final long workerId;
    private final long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;

    private static volatile SnowflakeIdGenerator instance;

    public SnowflakeIdGenerator(long workerId, long datacenterId) {
        if (workerId < 0 || workerId > MAX_WORKER) {
            throw new IllegalArgumentException("workerId 越界: " + workerId);
        }
        if (datacenterId < 0 || datacenterId > MAX_DC) {
            throw new IllegalArgumentException("datacenterId 越界: " + datacenterId);
        }
        this.workerId = workerId;
        this.datacenterId = datacenterId;
    }

    /** 进程级单例(按实例派生的 worker/datacenter)。 */
    public static SnowflakeIdGenerator getInstance() {
        if (instance == null) {
            synchronized (SnowflakeIdGenerator.class) {
                if (instance == null) {
                    instance = new SnowflakeIdGenerator(resolveWorkerId(), resolveDatacenterId());
                }
            }
        }
        return instance;
    }

    /** 便捷:取下一个 id 的 string 形式(契约里 id 一律 string 化)。 */
    public static String nextStr() {
        return Long.toString(getInstance().nextId());
    }

    public long getWorkerId() {
        return workerId;
    }

    public long getDatacenterId() {
        return datacenterId;
    }

    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();
        if (timestamp < lastTimestamp) {
            // 容忍时钟回拨:等待追平,绝不倒退发号
            timestamp = waitUntil(lastTimestamp);
        }
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & SEQ_MASK;
            if (sequence == 0) {
                timestamp = waitUntil(lastTimestamp + 1);
            }
        } else {
            sequence = 0L;
        }
        lastTimestamp = timestamp;
        return ((timestamp - EPOCH) << TS_SHIFT)
                | (datacenterId << DC_SHIFT)
                | (workerId << WORKER_SHIFT)
                | sequence;
    }

    private static long waitUntil(long target) {
        long ts = System.currentTimeMillis();
        while (ts < target) {
            ts = System.currentTimeMillis();
        }
        return ts;
    }

    private static long resolveWorkerId() {
        Long v = readLong("WORKER_ID");
        return (v != null ? v : hostHash()) & MAX_WORKER;
    }

    private static long resolveDatacenterId() {
        Long v = readLong("DATACENTER_ID");
        return (v != null ? v : (hostHash() >> WORKER_BITS)) & MAX_DC;
    }

    private static Long readLong(String envName) {
        String s = System.getenv(envName);
        if (s == null || s.trim().isEmpty()) {
            s = System.getProperty(envName.toLowerCase().replace('_', '.'));
        }
        if (s == null || s.trim().isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static long hostHash() {
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            host = "unknown-" + System.nanoTime();
        }
        long h = 1125899906842597L;
        for (int i = 0; i < host.length(); i++) {
            h = 31 * h + host.charAt(i);
        }
        return h & Long.MAX_VALUE;
    }
}
