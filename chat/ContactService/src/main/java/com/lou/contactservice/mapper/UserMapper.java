package com.lou.contactservice.mapper;

import com.lou.contactservice.model.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【user(用户表)】的数据库操作Mapper
* @createDate 2025-06-26 20:01:48
* @Entity com.lou.contactservice.model.User
*/
@Mapper
public interface UserMapper extends BaseMapper<User> {

}




