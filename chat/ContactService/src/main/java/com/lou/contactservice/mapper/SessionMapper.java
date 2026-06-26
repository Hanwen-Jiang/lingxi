package com.lou.contactservice.mapper;

import com.github.yulichang.base.MPJBaseMapper;
import com.lou.contactservice.model.Session;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * @author Lou
 * @description 针对表【session(会话表)】的数据库操作Mapper
 * @createDate 2025-06-28 14:30:15
 * @Entity com.lou.contactservice.model.Session
 */
@Mapper
public interface SessionMapper extends MPJBaseMapper<Session> {

}




