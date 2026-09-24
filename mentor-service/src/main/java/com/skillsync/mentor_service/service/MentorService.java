
package com.skillsync.mentor_service.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.skillsync.mentor_service.entity.Mentor;
import com.skillsync.mentor_service.repository.MentorRepository;

import com.skillsync.mentor_service.exception.ResourceNotFoundException;

@Service
public class MentorService {

    @Autowired
    private MentorRepository mentorRepository;
    @Autowired
    private RabbitTemplate rabbitTemplate;
    @Autowired
    private ObjectMapper objectMapper;

    // Add Mentor
    public Mentor addMentor(Mentor mentor) {
        if (mentor.getStatus() == null || mentor.getStatus().isBlank()) {
            mentor.setStatus("APPROVED");
        }
        return mentorRepository.save(mentor);
    }

    // Apply to become Mentor
    public Mentor applyMentor(Mentor mentor) {
        mentorRepository.findByUserId(mentor.getUserId()).ifPresent(existing -> {
            throw new IllegalArgumentException("Mentor application already exists for userId: " + mentor.getUserId());
        });
        mentor.setStatus("PENDING");
        return mentorRepository.save(mentor);
    }

    // Approve Mentor
    public Mentor approveMentor(Long id) {
        Mentor mentor = mentorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found with id: " + id));
        mentor.setStatus("APPROVED");
        Mentor saved = mentorRepository.save(mentor);
        publishMentorApprovedEvent(saved);
        return saved;
    }

    // Reject Mentor
    public Mentor rejectMentor(Long id) {
        Mentor mentor = mentorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found with id: " + id));
        mentor.setStatus("REJECTED");
        return mentorRepository.save(mentor);
    }

    // Update mentor availability
    public Mentor updateAvailability(Long id, String availability) {
        Mentor mentor = mentorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found with id: " + id));
        mentor.setAvailability(availability);
        return mentorRepository.save(mentor);
    }

    // Get All Mentors
    public List<Mentor> getAllMentors() {
        return mentorRepository.findAll();
    }

    // Get Mentor By ID
    public Mentor getMentorById(Long id) {
        return mentorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found with id: " + id));
    }

    public List<Mentor> getMentorsByStatus(String status) {
        return mentorRepository.findByStatus(status);
    }

    public List<Mentor> searchMentors(String skill, Double minRating, String experience, Double maxPrice, String availability) {
        List<Mentor> mentors = mentorRepository.findByStatus("APPROVED");

        return mentors.stream()
                .filter(m -> skill == null || skill.isBlank() || (m.getSkills() != null && m.getSkills().toLowerCase().contains(skill.toLowerCase())))
                .filter(m -> minRating == null || (m.getRating() != null && m.getRating() >= minRating))
                .filter(m -> experience == null || experience.isBlank() || (m.getExperience() != null && m.getExperience().toLowerCase().contains(experience.toLowerCase())))
                .filter(m -> maxPrice == null || (m.getHourlyRate() != null && m.getHourlyRate() <= maxPrice))
                .filter(m -> availability == null || availability.isBlank() || (m.getAvailability() != null && m.getAvailability().toLowerCase().contains(availability.toLowerCase())))
                .toList();
    }

    private void publishMentorApprovedEvent(Mentor mentor) {
        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("eventType", "MENTOR_APPROVED");
            payload.put("mentorId", mentor.getId());
            payload.put("userId", mentor.getUserId());

            String json = objectMapper.writeValueAsString(payload);
            rabbitTemplate.convertAndSend("session_queue", json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
