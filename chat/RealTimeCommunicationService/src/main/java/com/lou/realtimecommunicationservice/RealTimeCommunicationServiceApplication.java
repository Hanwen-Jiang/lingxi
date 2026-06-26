package com.lou.realtimecommunicationservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RealTimeCommunicationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RealTimeCommunicationServiceApplication.class, args);
    }

}
