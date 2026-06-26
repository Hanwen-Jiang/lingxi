package com.lou.momentservice.mapper;

import com.lou.momentservice.model.MomentLike;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【moment_like(朋友圈点赞)】的数据库操作Mapper
* @createDate 2025-06-21 21:52:40
* @Entity com.lou.momentservice.model.MomentLike
*/
@Mapper
public interface MomentLikeMapper extends BaseMapper<MomentLike> {

}




