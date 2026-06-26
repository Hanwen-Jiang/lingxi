package com.lou.offlinedatastoreservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.offlinedatastoreservice.model.Session;
import com.lou.offlinedatastoreservice.service.SessionService;
import com.lou.offlinedatastoreservice.mapper.SessionMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【session(会话表)】的数据库操作Service实现
* @createDate 2025-06-19 23:51:58
*/
@Service
public class SessionServiceImpl extends ServiceImpl<SessionMapper, Session>
    implements SessionService{

}




