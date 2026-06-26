package com.lou.contactservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.lou.contactservice.constants.ErrorEnum;
import com.lou.contactservice.data.ExitGroup.ExitGroupRequest;
import com.lou.contactservice.data.ExitGroup.ExitGroupResponse;
import com.lou.contactservice.exception.GroupException;
import com.lou.contactservice.exception.UserException;
import com.lou.contactservice.mapper.SessionMapper;
import com.lou.contactservice.mapper.UserMapper;
import com.lou.contactservice.mapper.UserSessionMapper;
import com.lou.contactservice.model.Session;
import com.lou.contactservice.model.User;
import com.lou.contactservice.model.UserSession;
import com.lou.contactservice.service.ExitGroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExitGroupServiceImpl implements ExitGroupService {

    private static final String USER_NOT_FOUND_MESSAGE = "用户不存在或状态异常";
    private static final String USER_NOT_IN_GROUP_MESSAGE = "用户不在该群聊中";
    private static final String EXIT_GROUP_SUCCESS_MESSAGE = "成功退出群聊";
    private static final int USER_STATUS_NORMAL = 1;
    private static final int SESSION_TYPE_GROUP = 2;
    private static final int USER_SESSION_STATUS_NORMAL = 1;


    @Autowired
    private UserMapper userMapper;

    @Autowired
    private SessionMapper sessionMapper;

    @Autowired
    private UserSessionMapper userSessionMapper;

    /**
     * 用户退出群聊的业务逻辑
     */
    @Transactional(rollbackFor = Exception.class)
    @Override
    public ExitGroupResponse exitGroup(ExitGroupRequest request) {
        Long userId = request.getUserId();
        Long sessionId = request.getSessionId();

        // 参数校验
        validateUser(userId);
        validateSession(sessionId);
        validateUserInGroup(userId, sessionId);

        // 删除用户与群聊的关联记录
        ExitGroupResponse response = new ExitGroupResponse();
        response.setSuccess(deleteUserSession(userId, sessionId));

        return response;
    }

    /**
     * 校验用户是否存在且状态正常
     *
     * @param userId 用户ID
     */
    private void validateUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new UserException(ErrorEnum.NO_USER_ERROR);
        }
        if (user.getStatus() != USER_STATUS_NORMAL) {
            throw new UserException(ErrorEnum.USER_STATUS_ERROR);
        }
    }

    /**
     * 校验会话是否为群聊且存在
     *
     * @param sessionId 会话ID
     */
    private void validateSession(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null || session.getType() != SESSION_TYPE_GROUP || session.getStatus() != USER_SESSION_STATUS_NORMAL) {
            throw new GroupException(ErrorEnum.GROUP_NOT_EXIST);
        }
    }

    /**
     * 校验用户是否在群聊中
     *
     * @param userId    用户ID
     * @param sessionId 会话ID
     */
    private void validateUserInGroup(Long userId, Long sessionId) {
        UserSession userSession = userSessionMapper.selectOne(
                new QueryWrapper<UserSession>()
                        .eq("user_id", userId)
                        .eq("session_id", sessionId)
                        .eq("status", USER_SESSION_STATUS_NORMAL)
        );
        if (userSession == null) {
            throw new GroupException(ErrorEnum.GROUP_USER_NOT_IN_GROUP);
        }
    }

    /**
     * 删除用户与群聊的关联记录
     * @param userId     用户ID
     * @param sessionId  会话ID
     */
    private boolean deleteUserSession(Long userId, Long sessionId) {
        int deleteRows = userSessionMapper.delete(
                new QueryWrapper<UserSession>()
                        .eq("user_id", userId)
                        .eq("session_id", sessionId)
                        .eq("status", USER_SESSION_STATUS_NORMAL)
        );
        if (deleteRows == 1) {
            return true;
        }
        if (deleteRows == 0) {
            throw new GroupException(ErrorEnum.GROUP_EXIT_FAILED);
        }
        return false;
    }
}
