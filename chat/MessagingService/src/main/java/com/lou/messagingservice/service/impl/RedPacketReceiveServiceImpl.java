package com.lou.messagingservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.common.ServiceException;
import com.lou.messagingservice.constants.BalanceLogType;
import com.lou.messagingservice.constants.RedPacketConstants;
import com.lou.messagingservice.constants.RedPacketStatus;
import com.lou.messagingservice.data.receviceRedPacket.RedPacketClaimResult;
import com.lou.messagingservice.data.receviceRedPacket.ReceiveRedPacketResponse;
import com.lou.messagingservice.mapper.BalanceLogMapper;
import com.lou.messagingservice.mapper.RedPacketMapper;
import com.lou.messagingservice.mapper.UserBalanceMapper;
import com.lou.messagingservice.model.BalanceLog;
import com.lou.messagingservice.model.RedPacket;
import com.lou.messagingservice.model.RedPacketReceive;
import com.lou.messagingservice.model.UserBalance;
import com.lou.messagingservice.service.GetRedPacketService;
import com.lou.messagingservice.service.RedPacketReceiveService;
import com.lou.messagingservice.mapper.RedPacketReceiveMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Objects;

/**
 * @author loujun
 * @description 针对表【red_packet_receive(红包领取记录表)】的数据库操作Service实现
 * @createDate 2025-06-15 16:48:46
 */
@Service
public class RedPacketReceiveServiceImpl extends ServiceImpl<RedPacketMapper, RedPacket>
        implements RedPacketReceiveService {

    private final UserBalanceMapper userBalanceMapper;

    private final BalanceLogMapper balanceLogMapper;

    private final RedPacketReceiveMapper redPacketReceiveMapper;

    private final RedisTemplate<String, Object> redisTemplate;

    private final StringRedisTemplate stringRedisTemplate;

    private final GetRedPacketService getRedPacketService;

    private final Snowflake snowflake;

    //Redis Lua脚本用于原子性地判断重复领取并弹出预拆金额
    private static final String RED_PACKET_CLAIM_LUA_SCRIPT = RedPacketConstants.RED_PACKET_CLAIM_LUA_SCRIPT.getValue();

    private static final String RED_PACKET_COMPENSATE_LUA_SCRIPT = RedPacketConstants.RED_PACKET_COMPENSATE_LUA_SCRIPT.getValue();

    private static final String RED_PACKET_AMOUNT_KEY_PREFIX = RedPacketConstants.RED_PACKET_AMOUNT_KEY_PREFIX.getValue();

    private static final String RED_PACKET_USER_KEY_PREFIX = RedPacketConstants.RED_PACKET_USER_KEY_PREFIX.getValue();

    private static final String RED_PACKET_EXPIRE_MARKER_KEY_PREFIX = RedPacketConstants.RED_PACKET_KEY_PREFIX.getValue();

    private static final Integer CLAIMED = RedPacketStatus.CLAIMED.getStatus();

    public RedPacketReceiveServiceImpl(UserBalanceMapper userBalanceMapper, BalanceLogMapper balanceLogMapper, RedPacketReceiveMapper redPacketReceiveMapper, RedisTemplate<String, Object> redisTemplate,
                                       StringRedisTemplate stringRedisTemplate, GetRedPacketService getRedPacketService) {
        this.userBalanceMapper = userBalanceMapper;
        this.balanceLogMapper = balanceLogMapper;
        this.redPacketReceiveMapper = redPacketReceiveMapper;
        this.redisTemplate = redisTemplate;
        this.stringRedisTemplate = stringRedisTemplate;
        this.getRedPacketService = getRedPacketService;
        this.snowflake = IdUtil.getSnowflake(
                Integer.parseInt(RedPacketConstants.WORKED_ID.getValue()),
                Integer.parseInt(RedPacketConstants.DATACENTER_ID.getValue())
        );
    }

    /**
     * 领取红包
     *
     * @param userId      用户ID
     * @param redPacketId 红包ID
     * @return ReceiveRedPacketResponse h红包领取响应
     * @throws ServiceException 业务异常
     */
    @Transactional
    public ReceiveRedPacketResponse receiveRedPacket(Long userId, Long redPacketId) throws ServiceException {

        //尝试抢红包，Redis原子判断重复领取并弹出预拆金额
        RedPacketClaimResult claimResult = claimRedPacketAmount(redPacketId, userId);
        if (claimResult.isReceived()) {
            BigDecimal amount = verifyUserHasNotReceived(redPacketId, userId);
            return new ReceiveRedPacketResponse(amount, 0);
        }
        if (claimResult.isEmpty()) {
            return new ReceiveRedPacketResponse(null, CLAIMED);
        }

        BigDecimal receivedAmount = claimResult.getAmount();
        try {
            // 获取红包信息
            RedPacket redPacket = getRedPacketById(redPacketId);

            //检查红包状态
            Integer status = validateRedPacketStatus(redPacket);
            if (status != 0) {
                clearRedPacketRedis(redPacketId);
                return new ReceiveRedPacketResponse(null, status);
            }

            // 更新红包信息
            updateRedPacketInfo(redPacketId, receivedAmount);

            // 插入领取记录
            LocalDateTime receivedTime = logRedPacketReceive(redPacketId, userId, receivedAmount);

            // 更新用户余额
            adjustUserBalance(userId, receivedAmount);

            // 记录余额变动日志
            logBalanceChange(userId, receivedAmount, redPacketId);

            clearRedisIfClaimed(redPacketId);

            // 构建响应对象
            return new ReceiveRedPacketResponse(receivedAmount, status);
        } catch (Exception e) {
            compensateRedisClaim(redPacketId, userId, receivedAmount);
            throw e;
        }
    }

    private RedPacketClaimResult claimRedPacketAmount(Long redPacketId, Long userId) {
        String amountKey = RED_PACKET_AMOUNT_KEY_PREFIX + redPacketId;
        String userKey = RED_PACKET_USER_KEY_PREFIX + redPacketId;
        DefaultRedisScript<String> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(RED_PACKET_CLAIM_LUA_SCRIPT);
        redisScript.setResultType(String.class);
        try {
            String result = stringRedisTemplate.execute(redisScript, Arrays.asList(amountKey, userKey), userId.toString());
            if (result == null) {
                throw new IllegalStateException("Redis 脚本执行返回 null");
            }
            if ("-1".equals(result)) {
                return RedPacketClaimResult.received();
            }
            if ("0".equals(result)) {
                return RedPacketClaimResult.empty();
            }
            return RedPacketClaimResult.success(new BigDecimal(result));
        } catch (Exception e) {
            throw new RuntimeException("执行 Redis Lua 脚本时出错", e);
        }
    }

    private void compensateRedisClaim(Long redPacketId, Long userId, BigDecimal receivedAmount) {
        String amountKey = RED_PACKET_AMOUNT_KEY_PREFIX + redPacketId;
        String userKey = RED_PACKET_USER_KEY_PREFIX + redPacketId;
        DefaultRedisScript<String> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(RED_PACKET_COMPENSATE_LUA_SCRIPT);
        redisScript.setResultType(String.class);
        try {
            stringRedisTemplate.execute(redisScript, Arrays.asList(amountKey, userKey),
                    userId.toString(), receivedAmount.toPlainString());
        } catch (Exception e) {
            throw new ServiceException("MySQL落库失败，Redis抢红包补偿也失败", e);
        }
    }

    /**
     * 获取红包信息，通过ID查询红包。
     *
     * @param redPacketId 红包ID
     * @return RedPacket 红包对象
     * @throws ServiceException 如果红包不存在
     */
    private RedPacket getRedPacketById(Long redPacketId) throws ServiceException {
        RedPacket redPacket = this.getById(redPacketId);
        if (redPacket == null) {
            throw new ServiceException("红包不存在");
        }
        return redPacket;
    }

    private Integer validateRedPacketStatus(RedPacket redPacket) throws ServiceException {
        if (Objects.equals(redPacket.getStatus(), RedPacketStatus.EXPIRED.getStatus())) {
            return RedPacketStatus.EXPIRED.getStatus();
        }
        if (redPacket.getRemainingCount() <= 0) {
            return RedPacketStatus.CLAIMED.getStatus();
        }
        return 0;
    }

    /**
     * 验证用户是否领取过该红包
     *
     * @param redPacketId 红包ID
     * @param userId      用户ID
     * @return 用户已领取金额
     */
    private BigDecimal verifyUserHasNotReceived(Long redPacketId, Long userId) {
        QueryWrapper<RedPacketReceive> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("red_packet_id", redPacketId).eq("receiver_id", userId);
        RedPacketReceive redPacketReceive = redPacketReceiveMapper.selectOne(queryWrapper);
        if (redPacketReceive == null) {
            return null;
        }
        return redPacketReceive.getAmount();
    }

    /**
     * 计算用户领取的红包金额，基于红包类型和剩余金额
     *
     * @param redPacket 红包对象
     * @return BigDecimal 领取金额
     * @throws ServiceException 如果红包类型未知
     */
    private void updateRedPacketInfo(Long redPacketId, BigDecimal receivedAmount) throws ServiceException {
        int updateCount = baseMapper.decreaseRemaining(
                redPacketId,
                receivedAmount,
                RedPacketStatus.UNCLAIMED.getStatus(),
                RedPacketStatus.CLAIMED.getStatus()
        );
        if (updateCount != 1) {
            throw new ServiceException("更新红包信息失败");
        }
    }

    private LocalDateTime logRedPacketReceive(Long redPacketId, Long userId, BigDecimal receivedAmount) throws ServiceException {
        RedPacketReceive receive = new RedPacketReceive();
        receive.setRedPacketReceiveId(generateId())
                .setRedPacketId(redPacketId)
                .setReceiverId(userId)
                .setAmount(receivedAmount)
                .setReceivedAt(LocalDateTime.now());

        int insertResult = redPacketReceiveMapper.insert(receive);
        if (insertResult != 1) {
            throw new ServiceException("红包领取记录插入失败");
        }
        return receive.getReceivedAt();
    }


    /**
     * 更新用户余额
     *
     * @param userId        用户ID
     * @param receiveAmount 领取金额
     * @throws ServiceException 如果更新用户余额失败
     */
    private void adjustUserBalance(Long userId, BigDecimal receiveAmount) throws ServiceException {
        int updateResult = userBalanceMapper.increaseBalance(userId, receiveAmount);
        if (updateResult != 1) {
            throw new ServiceException("更新用户余额失败");
        }
    }

    /**
     * 记录用户余额变动日志
     *
     * @param userId         用户ID
     * @param receivedAmount 变动余额
     * @param redPacketId    关联红包ID
     * @throws ServiceException 如果插入余额变动日志失败
     */
    private void logBalanceChange(Long userId, BigDecimal receivedAmount, Long redPacketId) throws ServiceException {
        BalanceLog balanceLog = new BalanceLog();
        balanceLog.setBalanceLogId(generateId())
                .setUserId(userId)
                .setAmount(receivedAmount)
                .setType(BalanceLogType.RECEIVE_RED_PACKET.getType())
                .setRelatedId(redPacketId)
                .setCreatedAt(LocalDateTime.now());

        int insertResult = balanceLogMapper.insert(balanceLog);
        if (insertResult != 1) {
            throw new ServiceException("记录余额变动日志失败");
        }
    }

    private void clearRedPacketRedis(Long redPacketId) {
        stringRedisTemplate.delete(RED_PACKET_AMOUNT_KEY_PREFIX + redPacketId);
        stringRedisTemplate.delete(RED_PACKET_USER_KEY_PREFIX + redPacketId);
        stringRedisTemplate.delete(RED_PACKET_EXPIRE_MARKER_KEY_PREFIX + redPacketId);
    }

    private void clearRedisIfClaimed(Long redPacketId) {
        RedPacket redPacket = getRedPacketById(redPacketId);
        if (Objects.equals(redPacket.getStatus(), RedPacketStatus.CLAIMED.getStatus())) {
            clearRedPacketRedis(redPacketId);
        }
    }

    /**
     * 生成唯一ID,使用雪花算法
     *
     * @return Long 唯一ID
     */
    private Long generateId() {
        return snowflake.nextId();
    }

}




