package com.lou.offlinedatastoreservice.mapper;

import com.lou.offlinedatastoreservice.model.UserSession;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author loujun
* @description 针对表【user_session】的数据库操作Mapper
* @createDate 2025-06-19 23:52:04
* @Entity com.lou.offlinedatastoreservice.model.UserSession
*/
@Mapper
public interface UserSessionMapper extends BaseMapper<UserSession> {

}




