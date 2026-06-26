package com.lou.offlinedatastoreservice.mapper;

import com.github.yulichang.base.MPJBaseMapper;
import com.lou.offlinedatastoreservice.model.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * @author loujun
 * @description 针对表【user(用户表)】的数据库操作Mapper
 * @createDate 2025-06-19 23:51:49
 * @Entity com.lou.offlinedatastoreservice.model.User
 */
@Mapper
public interface UserMapper extends MPJBaseMapper<User> {

}




