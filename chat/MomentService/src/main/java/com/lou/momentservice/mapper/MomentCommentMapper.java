package com.lou.momentservice.mapper;

import com.lou.momentservice.model.MomentComment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author loujun
* @description 针对表【moment_comment(朋友圈评论)】的数据库操作Mapper
* @createDate 2025-06-22 16:55:02
* @Entity com.lou.momentservice.model.MomentComment
*/
@Mapper
public interface MomentCommentMapper extends BaseMapper<MomentComment> {

}




