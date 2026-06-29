package com.lou.momentservice.data.getMomentList;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

@Data
@Accessors(chain = true)
public class GetMomentListResponse {
    @JsonSerialize(contentUsing = ToStringSerializer.class)
    private List<Long> deleteLike;

    @JsonSerialize(contentUsing = ToStringSerializer.class)
    private List<Long> deleteComment;

    @JsonSerialize(contentUsing = ToStringSerializer.class)
    private List<Long> deleteMoment;

    private List<MomentLikeVO> createLike;

    private List<MomentCommentVO> createComment;

    private List<MomentsVO> createMoment;
}
