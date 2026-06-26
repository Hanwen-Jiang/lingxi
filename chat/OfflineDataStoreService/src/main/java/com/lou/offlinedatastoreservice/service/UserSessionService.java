package com.lou.offlinedatastoreservice.service;

import com.lou.offlinedatastoreservice.model.UserSession;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.Set;

/**
 * @author loujun
 * @description 针对表【user_session】的数据库操作Service
 * @createDate 2025-06-19 23:52:04
 */
public interface UserSessionService extends IService<UserSession> {

    Set<Long> findSessionIdByUserId(Long userId);
}
