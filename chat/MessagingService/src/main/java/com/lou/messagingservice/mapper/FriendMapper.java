package com.lou.messagingservice.mapper;

import com.lou.messagingservice.model.Friend;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
* @author loujun
* @description 针对表【friend(联系人表)】的数据库操作Mapper
* @createDate 2025-06-12 16:47:16
* @Entity com.lou.messagingservice.model.Friend
*/
@Mapper
public interface FriendMapper extends BaseMapper<Friend> {


    @Select("SELECT * FROM friend WHERE user_id = #{userId} AND friend_id = #{friendId} AND status = 1")
    Friend selectFriendship(@Param("userId") Long userId, @Param("friendId") Long friendId);
}




