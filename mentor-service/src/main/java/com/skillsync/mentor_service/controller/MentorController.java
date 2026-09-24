
package com.skillsync.mentor_service.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import com.skillsync.mentor_service.entity.Mentor;
import com.skillsync.mentor_service.service.MentorService;

@RestController
@RequestMapping("/mentors")
public class MentorController {

    @Autowired
    private MentorService mentorService;

    // POST: Apply to become mentor
    @PostMapping("/apply")
    public Mentor applyMentor(@RequestBody Mentor mentor) {
        return mentorService.applyMentor(mentor);
    }

    // PUT: Approve mentor (Admin)
    @PutMapping("/{id}/approve")
    public Mentor approveMentor(@PathVariable Long id) {
        return mentorService.approveMentor(id);
    }

    // PUT: Reject mentor (Admin)
    @PutMapping("/{id}/reject")
    public Mentor rejectMentor(@PathVariable Long id) {
        return mentorService.rejectMentor(id);
    }

    // PUT: Update availability
    @PutMapping("/{id}/availability")
    public Mentor updateAvailability(@PathVariable Long id, @RequestParam String availability) {
        return mentorService.updateAvailability(id, availability);
    }

    // POST: Add mentor
    @PostMapping
    public Mentor addMentor(@RequestBody Mentor mentor) {
        return mentorService.addMentor(mentor);
    }

    // GET: Fetch mentors
    @GetMapping
    public List<Mentor> getMentors(
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) String experience,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) String availability
    ) {
        return mentorService.searchMentors(skill, minRating, experience, maxPrice, availability);
    }

    // GET: Fetch mentor by ID
    @GetMapping("/{id}")
    public Mentor getById(@PathVariable Long id) {
        return mentorService.getMentorById(id);
    }

    // GET: Fetch pending mentor applications for admin moderation
    @GetMapping("/pending")
    public List<Mentor> getPendingMentors() {
        return mentorService.getMentorsByStatus("PENDING");
    }
}
