package com.lou.realtimecommunicationservice.websocket;

import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.FullHttpRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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

            String userUuid = Optional.ofNullable(request.headers().get("userUuid")).map(CharSequence::toString).orElse("");
            String token = Optional.ofNullable(request.headers().get("token")).map(CharSequence::toString).orElse("");

            NettyUtils.setAttr(ctx.channel(), NettyUtils.TOKEN, token);
            NettyUtils.setAttr(ctx.channel(), NettyUtils.UID, userUuid);

            ctx.pipeline().remove(this);
            ctx.fireChannelRead(request);
        } else {
            ctx.fireChannelRead(msg);
        }
    }
}
