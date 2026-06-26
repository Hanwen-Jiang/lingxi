package com.lou.momentservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.momentservice.Exception.UserException;
import com.lou.momentservice.constants.ConfigEnum;
import com.lou.momentservice.constants.ErrorEnum;
import com.lou.momentservice.constants.MomentConstants;
import com.lou.momentservice.data.createComment.CreateCommentRequest;
import com.lou.momentservice.data.createComment.CreateCommentResponse;
import com.lou.momentservice.data.createComment.MomentCommentDTO;
import com.lou.momentservice.data.createComment.CreateCommentVO;
import com.lou.momentservice.data.deleteComment.DeleteCommentRequest;
import com.lou.momentservice.data.deleteComment.DeleteCommentResponse;
import com.lou.momentservice.model.MomentComment;
import com.lou.momentservice.model.User;
import com.lou.momentservice.service.MomentCommentService;
import com.lou.momentservice.mapper.MomentCommentMapper;
import com.lou.momentservice.service.MomentNotificationService;
import com.lou.momentservice.service.MomentService;
import com.lou.momentservice.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;

/**
 * @author loujun
 * @description 针对表【moment_comment(朋友圈评论)】的数据库操作Service实现
 * @createDate 2025-06-22 16:55:02
 */
@Service
@Slf4j
public class MomentCommentServiceImpl extends ServiceImpl<MomentCommentMapper, MomentComment>
        implements MomentCommentService {

    @Autowired
    private UserService userService;

    @Autowired
    @Lazy
    private MomentService momentService;

    @Autowired
    private MomentNotificationService momentNotificationService;

    @Override
    public CreateCommentResponse createComment(CreateCommentRequest request) throws Exception {
        CreateCommentVO createCommentVO = createCommentWithNotification(request.getMomentId(), request.getMomentCommentDTO());
        CreateCommentResponse response = new CreateCommentResponse();
        BeanUtils.copyProperties(createCommentVO, response);

        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public CreateCommentVO createCommentWithNotification(Long momentId, MomentCommentDTO momentCommentDTO) throws Exception {
        CreateCommentVO createCommentVO = createComment(momentId, momentCommentDTO);

        Long momentOwnerId = momentService.getMomentOwnerId(momentId);

        ArrayList<Long> receiveIds = new ArrayList<>();

        if (momentOwnerId != null && !momentOwnerId.equals(momentCommentDTO.getUserId())) {
            receiveIds.add(momentOwnerId);

            momentNotificationService.sendInteractionNotification(momentCommentDTO.getUserId(), momentId, receiveIds);

        }
        return createCommentVO;
    }

    public CreateCommentVO createComment(Long momentId, MomentCommentDTO momentCommentDTO) {
        MomentComment momentComment = createMomentComment(momentId, momentCommentDTO);
        boolean save = this.save(momentComment);

        if (!save) {
            log.error("评论保存失败: 朋友圈ID: {}, 用户ID: {}", momentId, momentCommentDTO.getUserId());
        }

        return buildCommentVO(momentComment, momentCommentDTO);
    }

    public MomentComment createMomentComment(Long momentId, MomentCommentDTO momentCommentDTO) {
        MomentComment momentComment = new MomentComment();
        Snowflake snowflake = IdUtil.getSnowflake(
                Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),
                Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())
        );

        momentComment.setCommentId(snowflake.nextId())
                .setComment(momentCommentDTO.getComment())
                .setMomentId(momentId)
                .setUserId(momentCommentDTO.getUserId())
                .setIsDelete(MomentConstants.NOT_DELETED);

        // 设置父评论ID（如果有）
        if (momentCommentDTO.getParentCommentId() != null) {
            momentComment.setParentCommentId(momentCommentDTO.getParentCommentId());
        }

        return momentComment;
    }


    private CreateCommentVO buildCommentVO(MomentComment momentComment, MomentCommentDTO momentCommentDTO) {
        CreateCommentVO createCommentVO = new CreateCommentVO();
        BeanUtils.copyProperties(momentCommentDTO, createCommentVO);

        User user = userService.getById(momentCommentDTO.getUserId());

        createCommentVO.setUserName(user.getUserName());

        // 设置父评论信息（如果有）
        if (momentCommentDTO.getParentCommentId() != null) {
            setParentCommentInfo(momentCommentDTO.getParentCommentId(), createCommentVO);
        }

        return createCommentVO;
    }

    private void setParentCommentInfo(Long parentCommentId, CreateCommentVO commentVO) {
        MomentComment parentComment = this.getById(parentCommentId);
        if (parentComment != null) {
            Long parentUserId = parentComment.getUserId();
            User parentUser = userService.getById(parentUserId);

            commentVO.setParentCommentId(parentComment.getParentCommentId())
                    .setParentUserName(parentUser.getUserName());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DeleteCommentResponse deleteComment(DeleteCommentRequest request) {
        deleteComment(request.getMomentId(), request.getCommentId(), request.getUserId());

        return new DeleteCommentResponse().setMessage(MomentConstants.DELETE_COMMENT_SUCCESS_MSG);
    }

    private void deleteComment(Long momentId, Long commentId, Long userId) {
        // 删除子评论
        deleteChildComments(momentId, commentId);

        // 删除当前评论
        deleteCurrentComment(momentId, commentId, userId);
    }

    private void deleteCurrentComment(Long momentId, Long commentId, Long userId) {
        // 查询评论
        MomentComment comment = findComment(momentId, commentId, userId);

        // 没查到评论或不是当前发起人进行的评论，则返回错误信息
        if (comment == null || comment.getIsDelete() == 1) {
            log.error("删除评论失败：找不到评论记录，朋友圈ID: {}, 评论ID: {}, 用户ID: {}", momentId, commentId, userId);

            throw new UserException(ErrorEnum.DELETE_MOMENT_COMMENT_FAILED_MSG);
        }

        // 标记为已删除
        comment.setIsDelete(MomentConstants.DELETED)
                .setUpdateTime(new Date());

        log.info("删除评论: {}", comment);

        // 更新数据库
        QueryWrapper<MomentComment> queryWrapper = createCommentQuery(momentId, commentId, userId);
        this.update(comment, queryWrapper);
    }

    private MomentComment findComment(Long momentId, Long commentId, Long userId) {
        QueryWrapper<MomentComment> queryWrapper = createCommentQuery(momentId, commentId, userId);
        return this.getOne(queryWrapper);
    }

    private QueryWrapper<MomentComment> createCommentQuery(Long momentId, Long commentId, Long userId) {
        QueryWrapper<MomentComment> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momentId)
                .eq(MomentConstants.FIELD_COMMENT_ID, commentId)
                .eq(MomentConstants.FIELD_USER_ID, userId);

        return queryWrapper;
    }

    private void deleteChildComments(Long momendId, Long parentCommentId) {
        QueryWrapper<MomentComment> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq(MomentConstants.FIELD_MOMENT_ID, momendId)
                .eq(MomentConstants.FIELD_PARENT_COMMENT_ID, parentCommentId);

        MomentComment momentComment = new MomentComment();
        momentComment.setIsDelete(MomentConstants.DELETED)
                .setUpdateTime(new Date());

        this.update(momentComment, queryWrapper);
    }
}




