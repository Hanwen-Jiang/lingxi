package com.lou.authenticationservice.mapper;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.lou.authenticationservice.model.User;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

/**
* @author Lou
* @description 针对表【user(用户表)】的数据库操作Mapper
* @createDate 2025-05-30 14:53:00
* @Entity generator.domain.User
*/
public interface UserMapper extends BaseMapper<User> {

    /** 按 email 查询单个用户(D14:用户标识切换为邮箱)。 */
    default User selectByEmail(String email) {
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("email", email).last("limit 1");
        return this.selectOne(wrapper);
    }

}
