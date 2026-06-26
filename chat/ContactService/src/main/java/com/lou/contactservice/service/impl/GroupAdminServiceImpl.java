package com.lou.contactservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.lou.contactservice.constants.UserRole;
import com.lou.contactservice.data.SetAdmin.SetGroupAdminRequest;
import com.lou.contactservice.data.SetAdmin.SetGroupAdminResponse;
import com.lou.contactservice.exception.ServiceException;
import com.lou.contactservice.mapper.SessionMapper;
import com.lou.contactservice.mapper.UserSessionMapper;
import com.lou.contactservice.model.Session;
import com.lou.contactservice.model.User;
import com.lou.contactservice.model.UserSession;
import com.lou.contactservice.service.GroupAdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Objects;

/**
 * @ClassName GroupAdminServiceImpl
 * @Description TODO
 * @Author Lou
 * @Date 2025/7/1 18:43
 */

@Service
public class GroupAdminServiceImpl implements GroupAdminService {

    @Autowired
    private SessionMapper sessionMapper;

    @Autowired
    private UserSessionMapper userSessionMapper;

    @Override
    public SetGroupAdminResponse setGroupAdmin(SetGroupAdminRequest request) {

        Long sessionId = request.getSessionId();
        Long userId = request.getUserId();
        Long targetId = request.getTargetId();
        Boolean isAdmin = request.getIsAdmin();

        // 1. 校验群是否存在
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new ServiceException("群聊不存在");
        }

        // 2. 校验操作人是否为群主或管理员
        UserSession operator = userSessionMapper.selectOne(
                new QueryWrapper<UserSession>()
                        .eq("session_id", sessionId)
                        .eq("user_id", userId)
                        .eq("status", 1)
        );
        if (operator == null) {
            throw new ServiceException("操作人不在群里");
        }
        if (!Objects.equals(operator.getRole(),UserRole.GROUP_OWNER.getValue())) {
            throw new ServiceException("无权限设置管理员");
        }

        // 3. 校验目标成员是否在群里
        UserSession target = userSessionMapper.selectOne(
                new QueryWrapper<UserSession>()
                        .eq("session_id", sessionId)
                        .eq("user_id", targetId)
        );
        if (target == null) {
            throw new ServiceException("目标用户不在群里");
        }

        // 4. 更新角色
        int newRole = isAdmin ? UserRole.GROUP_ADMIN.getValue() : UserRole.GROUP_MEMBER.getValue();
        target.setRole(newRole);
        userSessionMapper.update(
                new UserSession().setRole(newRole).setUpdatedAt(new Date()),
                new UpdateWrapper<UserSession>()
                        .eq("session_id", sessionId)
                        .eq("user_id", targetId)
        );


        // 5. 返回结果
        SetGroupAdminResponse response = new SetGroupAdminResponse();
        response.setSuccess(true);
        response.setMessage(isAdmin ? "已设置为管理员" : "已取消管理员");

        return response;
    }
}
