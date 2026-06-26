package com.lou.gatewaylb;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;
import java.util.Map;
import java.util.TreeMap;

public class ConsistentHashRing<T> {

    private static final int DEFAULT_VIRTUAL_NODE_COUNT = 160;

    private final TreeMap<Long, T> ring = new TreeMap<>();
    private final int virtualNodeCount;

    public ConsistentHashRing(Collection<Node<T>> nodes) {
        this(nodes, DEFAULT_VIRTUAL_NODE_COUNT);
    }

    public ConsistentHashRing(Collection<Node<T>> nodes, int virtualNodeCount) {
        this.virtualNodeCount = virtualNodeCount;
        for (Node<T> node : nodes) {
            addNode(node.getKey(), node.getValue());
        }
    }

    public T get(String key) {
        if (ring.isEmpty()) {
            return null;
        }
        long hash = hash(key);
        Map.Entry<Long, T> entry = ring.ceilingEntry(hash);
        if (entry == null) {
            entry = ring.firstEntry();
        }
        return entry.getValue();
    }

    private void addNode(String nodeKey, T node) {
        for (int i = 0; i < virtualNodeCount; i++) {
            ring.put(hash(nodeKey + "#" + i), node);
        }
    }

    private long hash(String key) {
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] digest = md5.digest(key.getBytes(StandardCharsets.UTF_8));
            return ((long) (digest[0] & 0xff) << 56)
                    | ((long) (digest[1] & 0xff) << 48)
                    | ((long) (digest[2] & 0xff) << 40)
                    | ((long) (digest[3] & 0xff) << 32)
                    | ((long) (digest[4] & 0xff) << 24)
                    | ((long) (digest[5] & 0xff) << 16)
                    | ((long) (digest[6] & 0xff) << 8)
                    | ((long) (digest[7] & 0xff));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 algorithm is unavailable", e);
        }
    }

    public static class Node<T> {
        private final String key;
        private final T value;

        public Node(String key, T value) {
            this.key = key;
            this.value = value;
        }

        public String getKey() {
            return key;
        }

        public T getValue() {
            return value;
        }
    }
}
