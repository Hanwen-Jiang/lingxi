package com.lou.messagingservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.common.ServiceException;
import com.lou.messagingservice.constants.BalanceLogType;
import com.lou.messagingservice.constants.RedPacketConstants;
import com.lou.messagingservice.constants.RedPacketStatus;
import com.lou.messagingservice.data.sendMsg.SendMsgRequest;
import com.lou.messagingservice.data.sendMsg.SendMsgResponse;
import com.lou.messagingservice.data.sendRedPacket.RedPacketMessageBody;
import com.lou.messagingservice.data.sendRedPacket.SendRedPacketRequest;
import com.lou.messagingservice.data.sendRedPacket.SendRedPacketResponse;
import com.lou.messagingservice.mapper.BalanceLogMapper;
import com.lou.messagingservice.mapper.MessageMapper;
import com.lou.messagingservice.mapper.UserBalanceMapper;
import com.lou.messagingservice.model.BalanceLog;
import com.lou.messagingservice.model.RedPacket;
import com.lou.messagingservice.model.UserBalance;
import com.lou.messagingservice.service.MessageService;
import com.lou.messagingservice.service.RedPacketService;
import com.lou.messagingservice.mapper.RedPacketMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * @author loujun
 * @description 针对表【red_packet(红包主表)】的数据库操作Service实现
 * @createDate 2025-06-14 18:35:21
 */
@Service
@Slf4j
public class RedPacketServiceImpl extends ServiceImpl<RedPacketMapper, RedPacket>
        implements RedPacketService {

    private final UserBalanceMapper userBalanceMapper;

    private final BalanceLogMapper balanceLogMapper;

    private final MessageMapper messageMapper;

    private final RedisTemplate<String, Object> redisTemplate;

    private final StringRedisTemplate stringRedisTemplate;

    private final Snowflake snowflake;
    private final MessageService messageService;

    private final TransactionTemplate transactionTemplate;

    @Value("${red-packet.expire-scan-limit:100}")
    private int expireScanLimit;

    @Autowired
    public RedPacketServiceImpl(UserBalanceMapper userBalanceMapper,
                                BalanceLogMapper balanceLogMapper,
                                MessageMapper messageMapper,
                                RedisTemplate<String, Object> redisTemplate,
                                StringRedisTemplate stringRedisTemplate,
                                PlatformTransactionManager transactionManager,
                                MessageService messageService) {
        this.userBalanceMapper = userBalanceMapper;
        this.balanceLogMapper = balanceLogMapper;
        this.messageMapper = messageMapper;
        this.redisTemplate = redisTemplate;
        this.stringRedisTemplate = stringRedisTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.snowflake = IdUtil.getSnowflake(
                Integer.parseInt(RedPacketConstants.WORKED_ID.getValue()),
                Integer.parseInt(RedPacketConstants.DATACENTER_ID.getValue()
                ));
        this.messageService = messageService;
    }

    @Override
    @Transactional
    public SendRedPacketResponse sendRedPacket(SendRedPacketRequest request) throws Exception {
        RedPacket redPacket = null;
        boolean redisInitialized = false;
        //提取并验证参数
        try {
            SendRedPacketRequest.Body body = request.getBody();
            validateSendRedPacketRequest(body);

            Long senderId = request.getSendUserId();
            BigDecimal totalAmount = body.getTotalAmount();
            int totalCount = body.getTotalCount();
            int redPacketType = body.getRedPacketType();

            //检查发送者余额
            deductUserBalance(senderId, totalAmount);

            //创建红包记录
            redPacket = createRedPacket(senderId, request, body, totalAmount, totalCount, redPacketType);

            //记录余额变更日志
            createBalanceLog(senderId, totalAmount.negate(), BalanceLogType.SEND_RED_PACKET, redPacket.getRedPacketId());

            //预拆金额并初始化Redis抢红包数据
            initializeRedPacketToRedis(redPacket, redPacketType);
            redisInitialized = true;

            //发送红包消息
            SendRedPacketResponse response = sendRedPacketMessage(request, redPacket);

            return response;
        } catch (Exception e) {
            if (redisInitialized && redPacket != null) {
                clearRedPacketRedis(redPacket.getRedPacketId());
            }
            throw e;
        }
    }

    /**
     * 将预拆红包金额初始化到Redis
     */
    private void initializeRedPacketToRedis(RedPacket redPacket, int redPacketType) {
        Long redPacketId = redPacket.getRedPacketId();
        String amountKey = RedPacketConstants.RED_PACKET_AMOUNT_KEY_PREFIX.getValue() + redPacketId;
        String userKey = RedPacketConstants.RED_PACKET_USER_KEY_PREFIX.getValue() + redPacketId;
        String expireMarkerKey = RedPacketConstants.RED_PACKET_KEY_PREFIX.getValue() + redPacketId;
        Duration expireDuration = Duration.ofHours(RedPacketConstants.RED_PACKET_EXPIRE_HOURS.getIntValue());

        List<String> amounts = splitRedPacketAmounts(redPacket.getTotalAmount(), redPacket.getTotalCount(), redPacketType);
        stringRedisTemplate.delete(amountKey);
        stringRedisTemplate.delete(userKey);
        stringRedisTemplate.opsForList().rightPushAll(amountKey, amounts);
        stringRedisTemplate.opsForValue().set(expireMarkerKey, String.valueOf(redPacket.getTotalCount()), expireDuration);
        stringRedisTemplate.expire(amountKey, expireDuration);
        stringRedisTemplate.expire(userKey, expireDuration);
    }

    private void clearRedPacketRedis(Long redPacketId) {
        stringRedisTemplate.delete(RedPacketConstants.RED_PACKET_AMOUNT_KEY_PREFIX.getValue() + redPacketId);
        stringRedisTemplate.delete(RedPacketConstants.RED_PACKET_USER_KEY_PREFIX.getValue() + redPacketId);
        stringRedisTemplate.delete(RedPacketConstants.RED_PACKET_KEY_PREFIX.getValue() + redPacketId);
    }

    private List<String> splitRedPacketAmounts(BigDecimal totalAmount, int totalCount, int redPacketType) {
        if (RedPacketConstants.RED_PACKET_TYPE_NORMAL.getIntValue().equals(redPacketType)) {
            return splitNormalRedPacketAmounts(totalAmount, totalCount);
        }
        return splitRandomRedPacketAmounts(totalAmount, totalCount);
    }

    private List<String> splitNormalRedPacketAmounts(BigDecimal totalAmount, int totalCount) {
        List<String> amounts = new ArrayList<>(totalCount);
        BigDecimal averageAmount = totalAmount.divide(new BigDecimal(totalCount),
                RedPacketConstants.AMOUNT_SCALE.getDivideScale(), RoundingMode.DOWN);
        BigDecimal usedAmount = BigDecimal.ZERO;
        for (int i = 1; i < totalCount; i++) {
            amounts.add(averageAmount.toPlainString());
            usedAmount = usedAmount.add(averageAmount);
        }
        amounts.add(totalAmount.subtract(usedAmount).setScale(RedPacketConstants.AMOUNT_SCALE.getDivideScale(), RoundingMode.DOWN).toPlainString());
        return amounts;
    }

    private List<String> splitRandomRedPacketAmounts(BigDecimal totalAmount, int totalCount) {
        List<String> amounts = new ArrayList<>(totalCount);
        BigDecimal remainingAmount = totalAmount;
        int remainingCount = totalCount;
        BigDecimal minAmount = RedPacketConstants.MIN_AMOUNT.getBigDecimalValue();

        while (remainingCount > 1) {
            BigDecimal maxAmount = remainingAmount
                    .divide(new BigDecimal(remainingCount), RedPacketConstants.AMOUNT_SCALE.getDivideScale(), RoundingMode.DOWN)
                    .multiply(RedPacketConstants.RANDOM_MULTIPLIER.getBigDecimalValue());
            BigDecimal maxAllowed = remainingAmount.subtract(minAmount.multiply(new BigDecimal(remainingCount - 1)));
            if (maxAmount.compareTo(maxAllowed) > 0) {
                maxAmount = maxAllowed;
            }
            BigDecimal amount = generateRandomAmount(minAmount, maxAmount);
            amounts.add(amount.toPlainString());
            remainingAmount = remainingAmount.subtract(amount);
            remainingCount--;
        }

        amounts.add(remainingAmount.setScale(RedPacketConstants.AMOUNT_SCALE.getDivideScale(), RoundingMode.DOWN).toPlainString());
        return amounts;
    }

    /**
     * 创建红包记录
     *
     * @param senderId      发送者ID
     * @param request       发送红包请求
     * @param body          请求体
     * @param totalAmount   红包总金额
     * @param totalCount    红包总个数
     * @param redPacketType 红包类型
     * @return 创建的红包对象
     */
    private RedPacket createRedPacket(Long senderId, SendRedPacketRequest request, SendRedPacketRequest.Body body,
                                      BigDecimal totalAmount, int totalCount, int redPacketType) {
        RedPacket redPacket = new RedPacket();
        redPacket.setRedPacketId(generateId())
                .setSenderId(senderId)
                .setSessionId(request.getSessionId());

        // 若红包封面文案是否为空或为null则设置默认祝福语
        String text = body.getRedPacketWrapperText();
        if (text == null || text.trim().isEmpty()) {
            redPacket.setRedPacketWrapperText("恭喜发财，大吉大利");
        } else {
            redPacket.setRedPacketWrapperText(text);
        }

        redPacket.setRedPacketType(redPacketType)
                .setTotalAmount(totalAmount)
                .setTotalCount(totalCount)
                .setRemainingAmount(totalAmount)
                .setRemainingCount(totalCount)
                .setStatus(RedPacketStatus.UNCLAIMED.getStatus())
                .setCreatedAt(LocalDateTime.now())
                .setExpireAt(LocalDateTime.now().plusHours(RedPacketConstants.RED_PACKET_EXPIRE_HOURS.getIntValue()));

        this.save(redPacket);
        return redPacket;
    }

    /**
     * 扣除用户金额
     *
     * @param userBalance 用户余额
     * @param amount      扣除金额
     * @throws ServiceException 扣减余额失败
     */
    private void deductUserBalance(Long userId, BigDecimal amount) throws ServiceException {
        int updateCount = userBalanceMapper.deductBalance(userId, amount);
        if (updateCount != 1) {
            throw new ServiceException("余额不足或扣减失败");
        }
    }

    /**
     * 验证发送红包请求的参数
     *
     * @param body 请求体
     * @throws ServiceException 参数验证失败
     */
    private void validateSendRedPacketRequest(SendRedPacketRequest.Body body) throws ServiceException {
        if (body == null) {
            throw new ServiceException("请求体不能为空");
        }

        BigDecimal totalAmount = body.getTotalAmount();
        int totalCount = body.getTotalCount();
        int redPacketType = body.getRedPacketType();

        if (totalAmount == null || totalAmount.compareTo(RedPacketConstants.MIN_AMOUNT.getBigDecimalValue()) < 0) {
            throw new ServiceException("红包总金额不能低于0.01元");
        }

        BigDecimal maxTotalAmount = RedPacketConstants.MAX_AMOUNT_PER_PACKET.getBigDecimalValue()
                .multiply(BigDecimal.valueOf(totalCount));
        if (totalAmount.compareTo(maxTotalAmount) > 0) {
            throw new ServiceException("红包总金额超过允许的最大值");
        }

        BigDecimal minAmountPerPacket = totalAmount.divide(
                BigDecimal.valueOf(totalCount),
                RedPacketConstants.DIVIDE_SCALE.getIntValue(),
                RoundingMode.DOWN
        );

        if (minAmountPerPacket.compareTo(RedPacketConstants.MIN_AMOUNT.getBigDecimalValue()) < 0) {
            throw new ServiceException("单个红包金额不能低于0.01元");
        }

        if (minAmountPerPacket.compareTo(RedPacketConstants.MAX_AMOUNT_PER_PACKET.getBigDecimalValue()) > 0) {
            throw new ServiceException("单个红包金额不能超过200元");
        }

        if (!RedPacketConstants.RED_PACKET_TYPE_NORMAL.getIntValue().equals(redPacketType) &&
                !RedPacketConstants.RED_PACKET_TYPE_RANDOM.getIntValue().equals(redPacketType)) {
            throw new ServiceException("无效的红包类型");
        }


    }

    /**
     * 发送红包信息
     *
     * @param request   发送红包请求
     * @param redPacket 红包对象
     * @return 响应消息
     * @throws ServiceException 发送消息失败
     */
    private SendRedPacketResponse sendRedPacketMessage(SendRedPacketRequest request, RedPacket redPacket) throws ServiceException {
        SendMsgRequest sendMsgRequest = new SendMsgRequest();
        BeanUtils.copyProperties(request, sendMsgRequest);

        RedPacketMessageBody redPacketMessageBody = new RedPacketMessageBody();
        redPacketMessageBody.setContent(String.valueOf(redPacket.getRedPacketId()));
        redPacketMessageBody.setRedPacketWrapperText(redPacket.getRedPacketWrapperText());
        sendMsgRequest.setBody(redPacketMessageBody);

        try {
            SendMsgResponse sendMsgResponse = messageService.sendMessage(sendMsgRequest);
            SendRedPacketResponse sendRedPacketResponse = new SendRedPacketResponse();
            BeanUtils.copyProperties(sendMsgResponse, sendRedPacketResponse);
            return sendRedPacketResponse;
        } catch (Exception e) {
            log.error("发送红包消息失败，红包ID: {}", redPacket.getRedPacketId(), e);
            throw new ServiceException("发送红包消息失败");
        }
    }


    @Override
    public void handleExpireRedPacket(Long redPacketId) {
        Boolean refunded = transactionTemplate.execute(status -> refundExpiredRedPacket(redPacketId));
        if (Boolean.TRUE.equals(refunded)) {
            clearRedPacketRedis(redPacketId);
        }
    }

    @Scheduled(fixedDelayString = "${red-packet.expire-scan-fixed-delay:60000}")
    public void scanExpiredRedPackets() {
        List<RedPacket> expiredRedPackets = baseMapper.selectExpiredUnclaimed(
                LocalDateTime.now(),
                RedPacketStatus.UNCLAIMED.getStatus(),
                expireScanLimit
        );
        for (RedPacket redPacket : expiredRedPackets) {
            try {
                handleExpireRedPacket(redPacket.getRedPacketId());
            } catch (Exception e) {
                log.error("扫描过期红包退款失败，红包ID: {}", redPacket.getRedPacketId(), e);
            }
        }
    }

    private Boolean refundExpiredRedPacket(Long redPacketId) {
        int locked = baseMapper.markRefunding(
                redPacketId,
                LocalDateTime.now(),
                RedPacketStatus.UNCLAIMED.getStatus(),
                RedPacketStatus.REFUNDING.getStatus()
        );
        if (locked != 1) {
            log.info("红包无需退款或已被其他线程处理，红包ID: {}", redPacketId);
            return false;
        }

        RedPacket redPacket = getRedPacketById(redPacketId);
        BigDecimal remainingAmount = redPacket.getRemainingAmount();
        if (remainingAmount.compareTo(BigDecimal.ZERO) > 0) {
            refundRemainingAmount(redPacket);
        }

        int updated = baseMapper.markRefunded(
                redPacketId,
                RedPacketStatus.REFUNDING.getStatus(),
                RedPacketStatus.EXPIRED.getStatus()
        );
        if (updated != 1) {
            throw new ServiceException("更新红包过期状态失败");
        }
        return true;
    }

    /**
     * 获取红包记录
     *
     * @param redPacketId 红包ID
     * @return 红包对象
     */
    private RedPacket getRedPacketById(Long redPacketId) {
        return this.getById(redPacketId);
    }

    /**
     * 退还红包剩余金额并更新红包状态
     *
     * @param redPacket 红包对象
     * @throws ServiceException 退还余额失败
     */
    private void refundRemainingAmount(RedPacket redPacket) throws ServiceException {
        Long senderId = redPacket.getSenderId();
        BigDecimal remainingAmount = redPacket.getRemainingAmount();

        int updateCount = userBalanceMapper.increaseBalance(senderId, remainingAmount);
        if (updateCount != 1) {
            throw new ServiceException("退还余额失败");
        }
        createBalanceLog(senderId, remainingAmount, BalanceLogType.REFUND_RED_PACKET, redPacket.getRedPacketId());
    }


    /**
     * 获取用户余额信息
     *
     * @param userId 用户ID
     * @return 用户余额
     * @throws ServiceException 用户余额信息不存在或余额不足
     */
    private UserBalance getUserBalance(Long userId) throws ServiceException {
        UserBalance userBalance = userBalanceMapper.selectById(userId);
        if (userBalance == null) {
            throw new ServiceException("用户余额信息不存在");
        }
        return userBalance;
    }

    /**
     * 创建余额变更日志
     *
     * @param userId    用户ID
     * @param amount    变更金额
     * @param logType   变更类型
     * @param relatedId 关联ID(如红包ID)
     */
    private void createBalanceLog(Long userId, BigDecimal amount, BalanceLogType logType, Long relatedId) {
        BalanceLog balanceLog = new BalanceLog();
        balanceLog.setBalanceLogId(generateId());
        balanceLog.setUserId(userId);
        balanceLog.setAmount(amount);
        balanceLog.setType(logType.getType());
        balanceLog.setCreatedAt(LocalDateTime.now());
        balanceLog.setRelatedId(relatedId);
        balanceLogMapper.insert(balanceLog);
    }

    /**
     * 生成雪花ID
     *
     * @return 唯一ID
     */
    private Long generateId() {
        return snowflake.nextId();
    }

    private BigDecimal generateRandomAmount(BigDecimal min, BigDecimal max) {
        if (max.compareTo(min) <= 0) {
            return min;
        }
        BigDecimal range = max.subtract(min);
        BigDecimal randomInRange = range.multiply(BigDecimal.valueOf(Math.random()));
        BigDecimal randomAmount = min.add(randomInRange).setScale(RedPacketConstants.AMOUNT_SCALE.getDivideScale(), RoundingMode.DOWN);
        return randomAmount.compareTo(min) < 0 ? min : randomAmount;
    }
}




