package com.lou.momentservice.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.alibaba.nacos.shaded.com.google.gson.Gson;
import com.alibaba.nacos.shaded.com.google.gson.reflect.TypeToken;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.momentservice.Exception.DatabaseException;
import com.lou.momentservice.Exception.MomentException;
import com.lou.momentservice.constants.ConfigEnum;
import com.lou.momentservice.constants.ErrorEnum;
import com.lou.momentservice.constants.MomentConstants;
import com.lou.momentservice.data.createMoment.CreateMomentRequest;
import com.lou.momentservice.data.createMoment.CreateMomentResponse;
import com.lou.momentservice.data.deleteMoment.DeleteMomentRequest;
import com.lou.momentservice.data.deleteMoment.DeleteMomentResponse;
import com.lou.momentservice.data.getMomentList.*;
import com.lou.momentservice.model.MomentComment;
import com.lou.momentservice.model.MomentLike;
import com.lou.momentservice.model.vo.MomentVO;
import com.lou.momentservice.model.Moment;
import com.lou.momentservice.model.User;
import com.lou.momentservice.service.*;
import com.lou.momentservice.mapper.MomentMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * @author Lou
 * @description 针对表【moment(朋友圈)】的数据库操作Service实现
 * @createDate 2025-06-21 20:06:02
 */
@Service
@Slf4j
public class MomentServiceImpl extends ServiceImpl<MomentMapper, Moment> implements MomentService {

    @Autowired
    private FriendService friendService;

    @Autowired
    private UserService userService;

    @Autowired
    private MomentNotificationService momentNotificationService;

    @Autowired
    private MomentLikeService momentLikeService;

    @Autowired
    private MomentCommentService momentCommentService;

    private final Gson gson = new Gson();

    @Override
    public CreateMomentResponse createMoment(CreateMomentRequest request) throws Exception {

        Long userId = Long.valueOf(request.getUserId());

        MomentVO momentVO = createMomentWithNotification(userId, request.getText(), request.getMediaUrls());

        CreateMomentResponse createMomentResponse = new CreateMomentResponse();
        createMomentResponse.setUserId(momentVO.getUserId())
                .setText(momentVO.getText())
                .setMediaUrls(momentVO.getMediaUrls())
                .setMomentId(momentVO.getMomentId());
        return createMomentResponse;


    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DeleteMomentResponse deleteMoment(DeleteMomentRequest request) {
        Moment moment = validateMomentOwnership(request.getMomentId(), request.getUserId());

        deleteAssociatedData(request.getMomentId());

        // 标记为删除状态
        moment.setDeleteTime(new Date())
                .setUpdateTime(new Date());

        // 更新朋友圈记录
        QueryWrapper<Moment> queryWrapper = createMomentOwnerQuery(request.getMomentId(), request.getUserId());
        boolean update = this.update(moment, queryWrapper);

        if (!update) {
            throw new DatabaseException(ErrorEnum.DATABASE_ERROR.getCode(), ErrorEnum.DATABASE_ERROR.getMessage());
        }


        return new DeleteMomentResponse().setMessage(MomentConstants.DELETE_MOMENT_SUCCESS_MSG);
    }

    private Moment validateMomentOwnership(Long momentId, Long userId) {
        QueryWrapper<Moment> queryWrapper = createMomentOwnerQuery(momentId, userId);
        Moment moment = this.getOne(queryWrapper);

        if (moment == null) {
            throw new MomentException(ErrorEnum.DELETE_MOMENT_FAILED_MSG.getCode(), ErrorEnum.DELETE_MOMENT_FAILED_MSG.getMessage());
        }
        return moment;
    }

    private QueryWrapper<Moment> createMomentOwnerQuery(Long momentId, Long userId) {
        QueryWrapper<Moment> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momentId)
                .eq(MomentConstants.FIELD_USER_ID, userId);
        return queryWrapper;
    }

    @Override
    public Long getMomentOwnerId(Long momentId) {
        Moment moment = this.getById(momentId);

        return moment != null ? moment.getUserId() : null;
    }

    private MomentVO createMomentWithNotification(Long userId, String text, List<String> mediaUrls) throws Exception {
        // 保存朋友圈
        MomentVO momentVO = saveMoment(userId, text, mediaUrls);

        // 获取用户头像
        User user = userService.getById(userId);
        String avatar = user != null ? user.getAvatar() : null;


        // 发通知给朋友
        List<Long> friendIds = friendService.getFriendIds(userId);

        // 发送朋友圈创建通知
        momentNotificationService.sendMomentCreationNotification(userId, avatar, momentVO.getMomentId(), friendIds);

        return momentVO;
    }

    @Transactional
    public MomentVO saveMoment(Long userId, String text, List<String> urls) {
        // 将URL列表转换为JSON字符串
        String mediaUrls = gson.toJson(urls);

        // 创建朋友圈实体
        Moment moment = createMomentEntity(userId, text, mediaUrls);

        // 保存到数据库
        if (!this.save(moment)) {
            throw new DatabaseException(ErrorEnum.DATABASE_ERROR.getCode(), MomentConstants.ERROR_SAVE_FAILED);
        }

        log.info(MomentConstants.LOG_SAVE_SUCCESS, moment);

        return convertToMomentVO(moment, urls);
    }

    private Moment createMomentEntity(Long userId, String text, String mediaUrls) {
        Snowflake snowflake = createSnowflake();
        Moment moment = new Moment();
        moment.setUserId(userId)
                .setText(text)
                .setMediaUrl(mediaUrls)
                .setMomentId(snowflake.nextId());

        return moment;
    }

    private Snowflake createSnowflake() {
        return IdUtil.getSnowflake(
                Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),
                Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())
        );
    }

    private MomentVO convertToMomentVO(Moment moment, List<String> urls) {
        MomentVO momentVO = new MomentVO();
        BeanUtil.copyProperties(moment, momentVO);
        momentVO.setMediaUrls(urls);

        return momentVO;
    }

    private void deleteAssociatedData(Long momentId) {
        deleteAssociatedLikes(momentId);
        deleteAssociatedComments(momentId);
    }

    // 删除相关点赞
    private void deleteAssociatedLikes(Long momentId) {
        QueryWrapper<MomentLike> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momentId);
        momentLikeService.remove(queryWrapper);
    }

    // 删除朋友圈评论
    private void deleteAssociatedComments(Long momentId) {
        QueryWrapper<MomentComment> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momentId);
        momentCommentService.remove(queryWrapper);
    }

    @Override
    public GetMomentListResponse getMomentList(GetMomentListRequest request) {
        // 查询自己和好友
        List<Long> friendIds = friendService.getFriendIds(request.getUserId());
        friendIds.add(request.getUserId());

        // 查询用户信息
        Map<Long, User> userInfoMap = getUserInfoMap(friendIds);

        // 查询朋友圈
        QueryWrapper<Moment> momentQueryWrapper = new QueryWrapper<>();
        momentQueryWrapper.in("user_id", friendIds).ge("update_time", request.getTime());
        List<Moment> momentList = this.list(momentQueryWrapper);

        List<Long> momentIds = new ArrayList<>();
        for (Moment moment : momentList) {
            momentIds.add(moment.getMomentId());
        }

        // 查询点赞 / 评论(momentIds 为空时跳过:空 IN() 会产生非法 SQL → 500;新用户无动态即命中)
        List<MomentLike> momentLikeList = new ArrayList<>();
        List<MomentComment> momentCommentList = new ArrayList<>();
        if (!momentIds.isEmpty()) {
            QueryWrapper<MomentLike> momentLikeQueryWrapper = new QueryWrapper<>();
            momentLikeQueryWrapper.in("moment_id", momentIds).ge("update_time", request.getTime());
            momentLikeList = momentLikeService.list(momentLikeQueryWrapper);

            QueryWrapper<MomentComment> momentCommentQueryWrapper = new QueryWrapper<>();
            momentCommentQueryWrapper.in("moment_id", momentIds).ge("update_time", request.getTime());
            momentCommentList = momentCommentService.list(momentCommentQueryWrapper);
        }

        // 组装结果
        ArrayList<Long> deleteMoment = new ArrayList<>();
        ArrayList<Long> deleteLike = new ArrayList<>();
        ArrayList<Long> deleteComment = new ArrayList<>();

        List<MomentsVO> createMoment = new ArrayList<>();
        List<MomentLikeVO> createLike = new ArrayList<>();
        List<MomentCommentVO> createComment = new ArrayList<>();

        for (Moment moment : momentList) {
            // 不是自己好友直接过滤
            if (!userInfoMap.containsKey(moment.getUserId())) {
                continue;
            }

            if (moment.getDeleteTime() != null) {
                deleteMoment.add(moment.getMomentId());

                continue;
            }

            User user = userInfoMap.get(moment.getUserId());
            MomentsVO momentsVO = new MomentsVO();
            momentsVO.setMomentId(moment.getMomentId())
                    .setUserId(moment.getUserId())
                    .setUserName(user.getUserName())
                    .setAvatar(user.getAvatar())
                    .setText(moment.getText())
                    .setMediaUrls(gson.fromJson(moment.getMediaUrl(), new TypeToken<List<String>>() {
                    }.getType()))
                    .setCreateTime(moment.getCreateTime())
                    .setUpdateTime(moment.getUpdateTime())
                    .setDeleteTime(moment.getDeleteTime());

            createMoment.add(momentsVO);
        }

        for (MomentComment momentComment : momentCommentList) {
            // 不是自己的好友直接过滤掉
            if (!userInfoMap.containsKey(momentComment.getUserId())) {
                continue;
            }

            if (momentComment.getIsDelete() != 0) {
                deleteComment.add(momentComment.getCommentId());
                continue;
            }

            User user = userInfoMap.get(momentComment.getUserId());
            MomentCommentVO momentCommentVO = new MomentCommentVO();
            momentCommentVO.setMomentId(momentComment.getMomentId())
                    .setCommentId(momentComment.getCommentId())
                    .setUserId(momentComment.getUserId())
                    .setUserName(user.getUserName())
                    .setParentCommentId(momentComment.getParentCommentId())
                    .setComment(momentComment.getComment())
                    .setCreateTime(momentComment.getCreateTime())
                    .setUpdateTime(momentComment.getCreateTime());

            createComment.add(momentCommentVO);
        }

        for (MomentLike momentLike : momentLikeList) {
            // 不是自己好友直接过滤掉
            if (!userInfoMap.containsKey(momentLike.getUserId())) {
                continue;
            }

            if (momentLike.getIsDelete() != 0) {
                deleteLike.add(momentLike.getLikeId());
                continue;
            }

            User user = userInfoMap.get(momentLike.getUserId());
            MomentLikeVO likeVO = new MomentLikeVO();
            likeVO.setLikeId(momentLike.getLikeId())
                    .setMomentId(momentLike.getMomentId())
                    .setUserId(user.getUserId())
                    .setUserName(user.getUserName())
                    .setUserAvatar(user.getAvatar());
            createLike.add(likeVO);
        }

        GetMomentListResponse response = new GetMomentListResponse();
        response.setCreateMoment(createMoment)
                .setCreateLike(createLike)
                .setCreateComment(createComment)
                .setDeleteMoment(deleteMoment)
                .setDeleteComment(deleteComment)
                .setDeleteLike(deleteLike);

        return response;
    }

    private Map<Long, User> getUserInfoMap(List<Long> userIds) {
        QueryWrapper<User> userQueryWrapper = new QueryWrapper<>();
        userQueryWrapper.in("user_id", userIds);

        List<User> userList = userService.list(userQueryWrapper);
        HashMap<Long, User> userMap = new HashMap<>();

        for (User user : userList) {
            userMap.put(user.getUserId(), user);
        }

        return userMap;
    }
}



