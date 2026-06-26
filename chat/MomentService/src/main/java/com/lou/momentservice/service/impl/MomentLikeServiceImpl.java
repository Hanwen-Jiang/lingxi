package com.lou.momentservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.momentservice.Exception.DatabaseException;
import com.lou.momentservice.Exception.UserException;
import com.lou.momentservice.constants.ConfigEnum;
import com.lou.momentservice.constants.ErrorEnum;
import com.lou.momentservice.constants.MomentConstants;
import com.lou.momentservice.data.deleteLike.DeleteLikeRequest;
import com.lou.momentservice.data.deleteLike.DeleteLikeResponse;
import com.lou.momentservice.data.createLike.CreateLikeRequest;
import com.lou.momentservice.data.createLike.CreateLikeResponse;
import com.lou.momentservice.model.MomentLike;
import com.lou.momentservice.service.MomentLikeService;
import com.lou.momentservice.mapper.MomentLikeMapper;
import com.lou.momentservice.service.MomentNotificationService;
import com.lou.momentservice.service.MomentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
* @author Lou
* @description 针对表【moment_like(朋友圈点赞)】的数据库操作Service实现
* @createDate 2025-06-21 21:52:40
*/
@Service
@Slf4j
public class MomentLikeServiceImpl extends ServiceImpl<MomentLikeMapper, MomentLike>
    implements MomentLikeService{

    @Autowired
    private MomentNotificationService notificationService;

    @Autowired
    @Lazy  // 使用延迟加载避免循环依赖
    private MomentService momentService;

    /**
     * 创建点赞并发送通知
     *
     * @param momentId 朋友圈ID
     * @param userId 用户ID
     * @return 点赞ID
     * @throws Exception 可能发生的异常
     */
    @Transactional(rollbackFor = Exception.class)
    public Long createLikeWithNotification(Long momentId, Long userId) throws Exception {
        // 创建点赞
        Long likeId = createLike(momentId, userId);

        // 获取朋友圈所有者ID
        Long momentOwnerId = momentService.getMomentOwnerId(momentId);
        List<Long> receiverIds = new ArrayList<>();

        // 如果是自己点赞自己的朋友圈，不发送通知
        if (momentOwnerId != null && !momentOwnerId.equals(userId)) {
            receiverIds.add(momentOwnerId);
            // 发送点赞通知
            notificationService.sendInteractionNotification(userId, momentId, receiverIds);
        }

        return likeId;
    }

    /**
     * 创建点赞
     *
     * @param momentId 朋友圈ID
     * @param userId   点赞用户ID
     * @return 创建的点赞ID
     */
    @Override
    public Long createLike(Long momentId, Long userId) {
        // 创建点赞实体
        MomentLike like = createLikeEntity(momentId, userId);

        // 保存到数据库
        this.save(like);

        log.debug("用户 {} 对朋友圈 {} 创建了点赞, 点赞ID: {}", userId, momentId, like.getLikeId());

        return like.getLikeId();
    }

    @Override
    public CreateLikeResponse likeMoment(Long momentId, CreateLikeRequest request) throws Exception {
        Long likeId = createLikeWithNotification(momentId, request.getUserId());

        CreateLikeResponse response = new CreateLikeResponse();
        response.setLikeId(likeId);

        return response;
    }

    @Override
    public DeleteLikeResponse deleteLikeMoment(DeleteLikeRequest request) {
        // 检查点赞是否存在
        QueryWrapper<MomentLike> queryWrapper = new QueryWrapper<>();

        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID,request.getMomentId())
                .eq(MomentConstants.FIELD_LIKE_ID,request.getLikeId())
                .eq(MomentConstants.FIELD_USER_ID,request.getUserId());

        MomentLike like = this.getOne(queryWrapper);
        if (like == null) {
            log.error("删除点赞失败： 找不到点赞记录, 朋友圈ID: {}, 点赞ID: {}, 用户ID: {}",request.getMomentId(),request.getLikeId(),request.getUserId());

            throw new UserException(ErrorEnum.DELETE_LIKE_FAILED_MSG);
        }

        like.setIsDelete(MomentConstants.DELETED);
        like.setUpdateTime(new Date());

        boolean update = this.update(like, queryWrapper);
        if (!update){
            throw new DatabaseException(ErrorEnum.DATABASE_ERROR.getCode(),ErrorEnum.DATABASE_ERROR.getMessage());
        }

        return new DeleteLikeResponse().setMessage(MomentConstants.DELETE_LIKE_SUCCESS_MSG);
    }

    /**
     * 创建点赞实体
     *
     * @param momentId 朋友圈ID
     * @param userId   用户ID
     * @return 点赞实体
     */
    private MomentLike createLikeEntity(Long momentId, Long userId) {
        MomentLike like = new MomentLike();

        // 使用雪花算法生成ID
        Snowflake snowflake = IdUtil.getSnowflake(
                Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),
                Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())
        );

        like.setLikeId(snowflake.nextId());
        like.setMomentId(momentId);
        like.setUserId(userId);
        like.setIsDelete(MomentConstants.NOT_DELETED);

        return like;
    }
}




