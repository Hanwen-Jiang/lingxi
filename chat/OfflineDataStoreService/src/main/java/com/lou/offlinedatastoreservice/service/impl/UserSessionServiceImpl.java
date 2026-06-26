package com.lou.offlinedatastoreservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.offlinedatastoreservice.model.UserSession;
import com.lou.offlinedatastoreservice.service.UserSessionService;
import com.lou.offlinedatastoreservice.mapper.UserSessionMapper;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * @author loujun
 * @description 针对表【user_session】的数据库操作Service实现
 * @createDate 2025-06-19 23:52:04
 */
@Service
public class UserSessionServiceImpl extends ServiceImpl<UserSessionMapper, UserSession>
        implements UserSessionService {

    @Override
    public Set<Long> findSessionIdByUserId(Long userId) {
        QueryWrapper<UserSession> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);

        List<UserSession> userSessions = this.baseMapper.selectList(queryWrapper);

        return userSessions.stream().map(UserSession::getSessionId).collect(Collectors.toSet());
    }
}




