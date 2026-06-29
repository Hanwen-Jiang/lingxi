package com.lou.infinitechatagent.model.dto;

import com.lou.infinitechatagent.rag.dto.Citation;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * SSE 流式事件信封(契约 §9,版本化)。
 *
 * <p><b>信封形状</b>:{@code {v, type, ...}}。
 * <ul>
 *   <li>{@link #v}:schema 版本(当前 {@link #SCHEMA_VERSION});前端按版本兼容解析,字段只增不破。</li>
 *   <li>{@link #type}:事件类型,取值 {@code start | delta | usage | done | error}。</li>
 *   <li>{@link #buffered}:该路由是否<b>非真增量</b>(整段一次性 delta,而非逐 token)。真增量路由省略/false,
 *       非增量路由显式 {@code true},避免前端把"整段冒出"误当流式假死。</li>
 *   <li>{@link #sessionId}:string 化 snowflake(D5/§5)。</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StreamChatEvent {

    /** SSE 事件 schema 版本(§9)。字段只增不破时不变;形状破坏性变更才递增。 */
    public static final String SCHEMA_VERSION = "1";

    /** schema 版本号(§9):随每个事件下发,供前端版本化解析。 */
    @Builder.Default
    private String v = SCHEMA_VERSION;

    /** 事件类型:start | delta | usage | done | error(§9)。 */
    private String type;

    private String requestId;

    private String sessionId;

    private String text;

    private Integer code;

    private String message;

    private String route;

    private Boolean forced;

    private String reason;

    /**
     * 非真增量标记(§9):该路由不是逐 token 流式,而是整段一次性 delta 时置 {@code true}。
     * 真增量路由省略(NON_NULL 下不输出)。
     */
    private Boolean buffered;

    private List<Citation> citations;

    private Object toolTrace;

    private Integer inputTokens;

    private Integer outputTokens;
}
