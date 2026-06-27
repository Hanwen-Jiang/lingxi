package com.lou.contactservice.common;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 游标编解码(03-contracts.md §4)。
 * <p>nextCursor 不透明:把末条数值型 id 用 URL-safe base64 编码;解码后做 keyset 查询
 * (id &lt; cursor),不使用前导通配 LIKE 全表扫。
 */
public final class CursorCodec {

    private CursorCodec() {
    }

    /** 把数值 id 编码为不透明游标。 */
    public static String encode(long id) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Long.toString(id).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 解码客户端回传的游标为数值 id;非法游标 -&gt; 400 BAD_REQUEST。
     * 空/缺省返回 null(表示首页)。
     */
    public static Long decode(String cursor) {
        if (cursor == null || cursor.trim().isEmpty()) {
            return null;
        }
        try {
            byte[] raw = Base64.getUrlDecoder().decode(cursor.trim());
            return Long.parseLong(new String(raw, StandardCharsets.UTF_8).trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(CommonError.BAD_REQUEST, "无效的分页游标");
        }
    }
}
