package com.lou.momentservice.data.createMoment;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * @ClassName CreateMomentResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 19:55
 */

@Data
@Accessors(chain = true)
public class CreateMomentResponse {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long momentId;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;

    private String text;

    private List<String> mediaUrls;
}
