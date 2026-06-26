package com.lou.offlinedatastoreservice.mapper;

import com.lou.offlinedatastoreservice.model.Session;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author loujun
* @description 针对表【session(会话表)】的数据库操作Mapper
* @createDate 2025-06-19 23:51:58
* @Entity com.lou.offlinedatastoreservice.model.Session
*/
@Mapper
public interface SessionMapper extends BaseMapper<Session> {

}




