package com.lou.messagingservice.util;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 不透明游标编解码：把末条 messageId 做 base64(URL-safe) 编码作为 nextCursor，
 * 解码后用于 keyset 分页(message_id &lt; cursor)。绝不暴露原始 id 语义给前端。
 */
public final class CursorCodec {

    private CursorCodec() {
    }

    /** 把 messageId 编码为不透明游标。 */
    public static String encode(Long messageId) {
        if (messageId == null) {
            return null;
        }
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(String.valueOf(messageId).getBytes(StandardCharsets.UTF_8));
    }

    /** 解码游标为 messageId;非法游标 → 400 BAD_REQUEST。 */
    public static Long decode(String cursor) {
        if (cursor == null || cursor.trim().isEmpty()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor.trim());
            return Long.valueOf(new String(decoded, StandardCharsets.UTF_8).trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(CommonError.BAD_REQUEST, "无效的游标");
        }
    }
}
