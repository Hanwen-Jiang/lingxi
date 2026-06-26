package com.lou.infinitechatagent.config;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

public class HashEmbeddingModel implements EmbeddingModel {

    private final int dimension;

    public HashEmbeddingModel(int dimension) {
        if (dimension <= 0) {
            throw new IllegalArgumentException("dimension must be positive");
        }
        this.dimension = dimension;
    }

    @Override
    public Response<List<Embedding>> embedAll(List<TextSegment> textSegments) {
        List<Embedding> embeddings = textSegments.stream()
                .map(segment -> Embedding.from(vectorize(segment.text())))
                .toList();
        return Response.from(embeddings);
    }

    @Override
    public int dimension() {
        return dimension;
    }

    private float[] vectorize(String text) {
        float[] vector = new float[dimension];
        String normalized = text == null ? "" : text.toLowerCase();
        String[] tokens = normalized.split("\\s+");
        for (String token : tokens) {
            if (token.isBlank()) {
                continue;
            }
            byte[] hash = sha256(token);
            int bucket = Math.floorMod(toInt(hash, 0), dimension);
            float sign = (hash[4] & 1) == 0 ? 1.0f : -1.0f;
            vector[bucket] += sign;
        }
        normalize(vector);
        return vector;
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private static int toInt(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xff) << 24)
                | ((bytes[offset + 1] & 0xff) << 16)
                | ((bytes[offset + 2] & 0xff) << 8)
                | (bytes[offset + 3] & 0xff);
    }

    private static void normalize(float[] vector) {
        double sum = 0;
        for (float value : vector) {
            sum += value * value;
        }
        if (sum == 0) {
            return;
        }
        float norm = (float) Math.sqrt(sum);
        for (int i = 0; i < vector.length; i++) {
            vector[i] /= norm;
        }
    }
}
