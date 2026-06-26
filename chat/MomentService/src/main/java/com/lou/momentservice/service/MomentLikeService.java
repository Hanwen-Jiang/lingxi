package com.lou.momentservice.service;

import com.lou.momentservice.data.deleteLike.DeleteLikeRequest;
import com.lou.momentservice.data.deleteLike.DeleteLikeResponse;
import com.lou.momentservice.data.createLike.CreateLikeRequest;
import com.lou.momentservice.data.createLike.CreateLikeResponse;
import com.lou.momentservice.model.MomentLike;
import com.baomidou.mybatisplus.extension.service.IService;

/**
* @author Lou
* @description 针对表【moment_like(朋友圈点赞)】的数据库操作Service
* @createDate 2025-06-21 21:52:40
*/
public interface MomentLikeService extends IService<MomentLike> {

    /**
     * 创建点赞
     *
     * @param momentId 朋友圈ID
     * @param userId 点赞用户ID
     * @return 创建的点赞ID
     */
    Long createLike(Long momentId, Long userId);

    CreateLikeResponse likeMoment(Long momentId, CreateLikeRequest request) throws Exception;

    DeleteLikeResponse deleteLikeMoment(DeleteLikeRequest request);
}
