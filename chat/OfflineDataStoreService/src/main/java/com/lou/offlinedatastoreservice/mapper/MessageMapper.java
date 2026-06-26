package com.lou.offlinedatastoreservice.mapper;

import com.github.yulichang.base.MPJBaseMapper;
import com.lou.offlinedatastoreservice.model.Message;

import org.apache.ibatis.annotations.Mapper;

/**
* @author loujun
* @description 针对表【message】的数据库操作Mapper
* @createDate 2025-06-19 23:51:28
* @Entity com.lou.offlinedatastoreservice.model.Message
*/
@Mapper
public interface MessageMapper extends MPJBaseMapper<Message> {

}




