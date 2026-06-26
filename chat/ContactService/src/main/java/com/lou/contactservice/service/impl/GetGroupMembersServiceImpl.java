package com.lou.contactservice.service.impl;

import com.alibaba.nacos.client.naming.utils.CollectionUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.contactservice.constants.ErrorEnum;
import com.lou.contactservice.constants.SessionType;
import com.lou.contactservice.data.GetGroupMembers.GroupMemberDTO;
import com.lou.contactservice.data.GetGroupMembers.GroupMembersRequest;
import com.lou.contactservice.data.GetGroupMembers.GroupMembersResponse;
import com.lou.contactservice.exception.GroupException;
import com.lou.contactservice.mapper.SessionMapper;
import com.lou.contactservice.mapper.UserMapper;
import com.lou.contactservice.mapper.UserSessionMapper;
import com.lou.contactservice.model.Session;
import com.lou.contactservice.model.User;
import com.lou.contactservice.model.UserSession;
import com.lou.contactservice.service.GetGroupMembersService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GetGroupMembersServiceImpl extends ServiceImpl<SessionMapper, Session> implements GetGroupMembersService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserSessionMapper userSessionMapper;

    @Override
    public GroupMembersResponse getGroupMembers(GroupMembersRequest request) {
        Long sessionId = request.getSessionId();

        // 参数校验
        if (sessionId == null || sessionId <= 0) {
            throw new GroupException(ErrorEnum.GROUP_NOT_EXIST);
        }

        // 校验会话是否存在且为群聊
        Session session = selectSessionById(sessionId);

        if (session == null) {
            throw new GroupException(ErrorEnum.GROUP_NOT_EXIST);
        }
        if (!isGroupChat(session)) {
            throw new GroupException(ErrorEnum.NOT_GROUP);
        }

        // 查询群成员信息
        List<GroupMemberDTO> dtos = selectGroupMembers(sessionId);

        return new GroupMembersResponse(dtos, dtos.size());
    }

    /**
     * 根据会话ID查询会话信息
     *
     * @param sessionId 会话ID
     * @return 会话对象，如果不存在则返回null
     */
    public Session selectSessionById(Long sessionId) {
        return this.lambdaQuery()
                .eq(Session::getId, sessionId)
                .eq(Session::getStatus, 1)
                .one();
    }

    /**
     * 根据会话ID查询群成员信息
     *
     * @param sessionId 会话ID
     * @return 群成员列表
     */
    public List<GroupMemberDTO> selectGroupMembers(Long sessionId) {
        // 创建用户会话关联条件
        LambdaQueryWrapper<UserSession> userSessionWrapper = new LambdaQueryWrapper<>();
        userSessionWrapper.eq(UserSession::getSessionId, sessionId)
                .eq(UserSession::getStatus, 1);

        // 查询符合条件的用户ID列表
        List<Long> userIds = userSessionMapper.selectList(userSessionWrapper)
                .stream()
                .map(UserSession::getUserId)
                .collect(Collectors.toList());

        if (CollectionUtils.isEmpty(userIds)) {
            return Collections.emptyList();
        }

        // 根据用户ID列表查询用户信息
        LambdaQueryWrapper<User> userWrapper = new LambdaQueryWrapper<>();
        userWrapper.in(User::getUserId, userIds);

        // 将User实体转换为GroupMemberDTO
        return userMapper.selectList(userWrapper)
                .stream()
                .map(user -> {
                    GroupMemberDTO dto = new GroupMemberDTO();
                    dto.setUserId(String.valueOf(user.getUserId()));
                    dto.setUserName(user.getUserName());
                    dto.setAvatar(user.getAvatar());
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /**
     * 判断会话类型是否为群聊
     *
     * @param session 会话对象
     * @return 是否为群聊
     */
    private boolean isGroupChat(Session session) {
        return session.getType() == SessionType.GROUP.getValue();
    }


}
