package com.lou.contactservice.mapper;

import com.lou.contactservice.model.Friend;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【friend(联系人表)】的数据库操作Mapper
* @createDate 2025-06-26 19:57:12
* @Entity com.lou.contactservice.model.Friend
*/
@Mapper
public interface FriendMapper extends BaseMapper<Friend> {

}




