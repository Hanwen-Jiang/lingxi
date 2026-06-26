package com.lou.momentservice.mapper;

import com.lou.momentservice.model.Moment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
* @author Lou
* @description 针对表【moment(朋友圈)】的数据库操作Mapper
* @createDate 2025-06-21 20:06:02
* @Entity com.lou.momentservice.model.Moment
*/
@Mapper
public interface MomentMapper extends BaseMapper<Moment> {

}




