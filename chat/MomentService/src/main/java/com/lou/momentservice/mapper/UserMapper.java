package com.lou.momentservice.mapper;

import com.lou.momentservice.model.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【user(用户表)】的数据库操作Mapper
* @createDate 2025-06-21 21:19:22
* @Entity com.lou.momentservice.model.User
*/
@Mapper
public interface UserMapper extends BaseMapper<User> {

}




