package com.lou.momentservice.mapper;

import com.lou.momentservice.model.Friend;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【friend(联系人表)】的数据库操作Mapper
* @createDate 2025-06-21 21:14:43
* @Entity com.lou.momentservice.model.Friend
*/
@Mapper
public interface FriendMapper extends BaseMapper<Friend> {

}




