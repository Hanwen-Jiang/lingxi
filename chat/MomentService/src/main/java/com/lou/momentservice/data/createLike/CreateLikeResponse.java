package com.lou.momentservice.data.createLike;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class CreateLikeResponse {
    /**
     * 点赞ID
     */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long likeId;
}