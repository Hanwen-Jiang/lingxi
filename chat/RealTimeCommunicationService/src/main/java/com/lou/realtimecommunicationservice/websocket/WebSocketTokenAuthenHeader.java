package com.lou.realtimecommunicationservice.websocket;

import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.QueryStringDecoder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * @ClassName WebSocketTokenAuthenHeader
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 15:06
 */

@Slf4j
@RequiredArgsConstructor
@ChannelHandler.Sharable
public class WebSocketTokenAuthenHeader extends ChannelInboundHandlerAdapter {
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (msg instanceof FullHttpRequest) {
            FullHttpRequest request = (FullHttpRequest) msg;

            // 浏览器 WebSocket 无法设置自定义握手头，故 token/userUuid 既可来自握手头，
            // 也可来自 URL 查询参数 ?token=&userUuid=。优先级：头存在用头，否则取 query。
            QueryStringDecoder decoder = new QueryStringDecoder(request.uri());
            Map<String, List<String>> queryParams = decoder.parameters();

            String userUuid = resolve(request.headers().get("userUuid"), queryParams, "userUuid");
            String token = resolve(request.headers().get("token"), queryParams, "token");

            NettyUtils.setAttr(ctx.channel(), NettyUtils.TOKEN, token);
            NettyUtils.setAttr(ctx.channel(), NettyUtils.UID, userUuid);

            // B8 关键：剥离 query,改写为裸路径。否则下游 WebSocketServerProtocolHandler 用
            // 完整 uri("/api/v1/netty?token=...")与配置路径("/api/v1/netty")比较不相等 → 不升级握手,
            // 浏览器/带 query 的连接会静默挂起。原生端走握手头(无 query)不受影响。
            request.setUri(decoder.path());

            ctx.pipeline().remove(this);
            ctx.fireChannelRead(request);
        } else {
            ctx.fireChannelRead(msg);
        }
    }

    /**
     * 头存在则用头，否则回退到 query；都没有则返回空串。
     * JWT 验签与 sub == userUuid 的校验仍在握手完成后由下游统一执行。
     */
    private static String resolve(CharSequence headerValue, Map<String, List<String>> queryParams, String key) {
        if (headerValue != null) {
            return headerValue.toString();
        }
        return Optional.ofNullable(queryParams.get(key))
                .filter(values -> !values.isEmpty())
                .map(values -> values.get(0))
                .orElse("");
    }
}
