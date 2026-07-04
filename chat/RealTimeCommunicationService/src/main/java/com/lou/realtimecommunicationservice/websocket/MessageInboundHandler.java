package com.lou.realtimecommunicationservice.websocket;

import cn.hutool.json.JSONUtil;
import com.lou.realtimecommunicationservice.constants.MessageTypeEnum;
import com.lou.realtimecommunicationservice.constants.UserConstants;
import com.lou.realtimecommunicationservice.excption.MessageTypeException;
import com.lou.realtimecommunicationservice.model.AckData;
import com.lou.realtimecommunicationservice.model.LogOutData;
import com.lou.realtimecommunicationservice.model.MessageDTO;
import com.lou.realtimecommunicationservice.utils.JwtUtil;
import io.jsonwebtoken.Claims;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.handler.timeout.IdleStateEvent;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.net.InetAddress;
import java.util.concurrent.TimeUnit;

@Slf4j
@ChannelHandler.Sharable
@AllArgsConstructor
public class MessageInboundHandler extends SimpleChannelInboundHandler<TextWebSocketFrame> {

    private static final long ROUTE_TTL_MINUTES = 15L;

    private StringRedisTemplate redisTemplate;

    private AckMessageManager ackMessageManager;

    private int serverPort;

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame msg) throws Exception {
        log.info("服务端收到了消息:{}", msg.text());

        MessageDTO messageDTO = JSONUtil.toBean(msg.text(), MessageDTO.class);

        //ACK
        //HEART_BEAT
        //LOG_OUT

        MessageTypeEnum messageType = MessageTypeEnum.of(messageDTO.getType());
        switch (messageType) {
            case ACK:
                processACK(messageDTO);
                break;
            case LOG_OUT:
                processLogOut(ctx, messageDTO);
                break;
            case HEART_BEAT:
                processHeartBeat(ctx, messageDTO);
                break;
            default:
                processIllegal(messageDTO);
        }
    }

    private void processACK(MessageDTO msg) {
        //处理客户端成功返回的数据
        String ackId = msg.getMsgUuid();
        AckData ackData = null;
        if (ackId == null && msg.getData() != null) {
            ackData = JSONUtil.toBean(msg.getData().toString(), AckData.class);
            ackId = ackData.getMsgUuid();
        }
        boolean acked = ackMessageManager.ack(ackId);
        log.info("ackId:{}, ackData:{}, acked:{}", ackId, ackData, acked);
    }

    private void processLogOut(ChannelHandlerContext ctx, MessageDTO msg) {
        //处理客户端成功返回的数据
        LogOutData logOutData = JSONUtil.toBean(msg.getData().toString(), LogOutData.class);
        Integer userUuid = logOutData.getUserUuid();
        log.info("请求断开用户{}的连接...", userUuid);
        int removed = ackMessageManager.removeByUserId(userUuid == null ? null : userUuid.toString());
        log.info("用户主动登出，清理待ACK消息数量: {}", removed);
        offline(ctx);
        log.info("断开连接成功!");
    }

    private void processHeartBeat(ChannelHandlerContext ctx, MessageDTO msg) {
        log.info("收到心跳包");
        refreshRouteTtl(ctx);
        MessageDTO messageDTO = new MessageDTO();
        messageDTO.setType(MessageTypeEnum.HEART_BEAT.getCode());
        TextWebSocketFrame frame = new TextWebSocketFrame(JSONUtil.toJsonStr(messageDTO));
        ctx.channel().writeAndFlush(frame);
    }

    private void processIllegal(MessageDTO msg) {
        throw new MessageTypeException("不支持的消息格式!");
    }

    //管道打开时调用
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        log.info("websocket has build");
    }

    //管道关闭时调用
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        offline(ctx);
        super.channelInactive(ctx);
    }


    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        //处理心跳
        if (evt instanceof IdleStateEvent) {
            IdleStateEvent event = (IdleStateEvent) evt;

            switch (event.state()) {
                case READER_IDLE:
                    log.error("读空闲超时，关闭连接...{},用户ID{}", ctx.channel().remoteAddress(), ChannelManager.getUserByChannel(ctx.channel()));
                    offline(ctx);
                    break;
                case WRITER_IDLE:
                    log.error("写空闲超时");
                case ALL_IDLE:
                    log.error("读写空闲超时");
            }
        }

        //处理握手，协议升级
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            String token = NettyUtils.getAttr(ctx.channel(), NettyUtils.TOKEN);
            String userUuid = NettyUtils.getAttr(ctx.channel(), NettyUtils.UID);

            //对token进行校验，不通过则直接关闭
            if (!validateToken(userUuid, token)) {
                log.info("token invalid");
                ctx.close();
                return;
            }

            // 将登录信息放入到redis，用户与 netty 服务器的映射
            String currentRoute = InetAddress.getLocalHost().getHostAddress() + ":" + serverPort;
            redisTemplate.opsForValue().set(UserConstants.USER_SESSION + userUuid, currentRoute, ROUTE_TTL_MINUTES, TimeUnit.MINUTES);
            log.info("写入用户实时路由，userId: {}, route: {}", userUuid, currentRoute);


            //存储用户的管道信息
            Channel channel = ChannelManager.getChannelByUserId(userUuid);
            if (channel != null) {
                ChannelManager.removeUserChannel(userUuid);
                ChannelManager.removeChannelUser(channel);
                channel.close();
            }

            //在将新的 channel 放入其中
            ChannelManager.addUserChannel(userUuid, ctx.channel());
            ChannelManager.addChannelUser(userUuid, ctx.channel());
            System.out.println(userUuid + " " + ChannelManager.getChannelByUserId(userUuid));
            log.info("客户连接成功，用户ID: {}", userUuid + "管道地址: " + ctx.channel().remoteAddress());

            // M5:重连补投——从 Redis 载入未确认消息重推(崩溃恢复/跨节点重连)。durable 关闭时为空操作。
            ackMessageManager.redeliverPending(userUuid, ctx.channel());
        }
    }

    private void refreshRouteTtl(ChannelHandlerContext ctx) {
        String userUuid = ChannelManager.getUserByChannel(ctx.channel());
        if (userUuid == null) {
            userUuid = NettyUtils.getAttr(ctx.channel(), NettyUtils.UID);
        }
        if (userUuid != null) {
            redisTemplate.expire(UserConstants.USER_SESSION + userUuid, ROUTE_TTL_MINUTES, TimeUnit.MINUTES);
        }
    }

    // 下线函数
    public void offline(ChannelHandlerContext ctx) {
        String userUuid = ChannelManager.getUserByChannel(ctx.channel());

        try {
            ChannelManager.removeChannelUser(ctx.channel());
            if (userUuid != null) {
                ChannelManager.removeUserChannel(userUuid);
                log.info("客户端关闭连接UserId:{}, 客户端地址为: {}", userUuid, ctx.channel().remoteAddress());
            }
        } catch (Exception e) {
            log.error("处理退出登录异常", e);
        } finally {
            //关闭通道
            if (ctx.channel() != null) {
                ctx.channel().close();
            }
            // 在redis中删除对应的key
            redisTemplate.opsForValue().getAndDelete(UserConstants.USER_SESSION + userUuid);
        }
    }

    private boolean validateToken(String userUuid, String token) {
        Claims claims = JwtUtil.parse(token);
        String userId = claims.getSubject();

        return userId != null && userId.equals(userUuid);
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
        log.error("捕获到异常: ", cause);

        try {
            offline(ctx);
        } catch (Exception e) {
            log.error("关闭管道失败", e);
        }
    }

}
