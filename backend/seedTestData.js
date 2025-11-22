const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");
const Organization = require("./models/Organization");
const Hackathon = require("./models/Hackathon");
const Team = require("./models/Team");
const Idea = require("./models/Idea");
const HackathonRole = require("./models/HackathonRole");

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const clearDatabase = async () => {
    console.log("Clearing existing test data...");
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Hackathon.deleteMany({});
    await Team.deleteMany({});
    await Idea.deleteMany({});
    await HackathonRole.deleteMany({});
    console.log("Database cleared!");
};

const seedData = async () => {
    try {
        await connectDB();
        await clearDatabase();

        console.log("\n🌱 Starting data seeding...\n");

        // ========== ORGANIZATION 1 ==========
        console.log("📦 Creating Organization 1: Tech Corp");
        const org1 = await Organization.create({
            name: "Tech Corp",
            domain: "techcorp.com",
        });

        // Create users for Organization 1 (9 users)
        console.log("👥 Creating users for Tech Corp...");
        const org1Users = [];
        
        // Admin for Org1
        const org1Admin = await User.create({
            name: "Alice Admin",
            email: "alice.admin@techcorp.com",
            role: "admin",
            expertise: "Platform Management",
            googleId: "google_alice_admin_001",
            organization: org1._id,
        });
        org1Users.push(org1Admin);

        // Hackathon Creator
        const org1Creator = await User.create({
            name: "Bob Creator",
            email: "bob.creator@techcorp.com",
            role: "hackathon_creator",
            expertise: "Event Management",
            googleId: "google_bob_creator_002",
            organization: org1._id,
        });
        org1Users.push(org1Creator);

        // Regular users for Org1
        const org1RegularUsers = await User.create([
            {
                name: "Charlie User",
                email: "charlie.user@techcorp.com",
                role: "user",
                expertise: "Frontend Development",
                googleId: "google_charlie_003",
                organization: org1._id,
            },
            {
                name: "Diana Developer",
                email: "diana.dev@techcorp.com",
                role: "user",
                expertise: "Backend Development",
                googleId: "google_diana_004",
                organization: org1._id,
            },
            {
                name: "Ethan Engineer",
                email: "ethan.eng@techcorp.com",
                role: "user",
                expertise: "DevOps",
                googleId: "google_ethan_005",
                organization: org1._id,
            },
            {
                name: "Fiona Designer",
                email: "fiona.design@techcorp.com",
                role: "user",
                expertise: "UI/UX Design",
                googleId: "google_fiona_006",
                organization: org1._id,
            },
            {
                name: "George Mentor",
                email: "george.mentor@techcorp.com",
                role: "user",
                expertise: "AI/ML",
                googleId: "google_george_007",
                organization: org1._id,
            },
            {
                name: "Hannah Judge",
                email: "hannah.judge@techcorp.com",
                role: "user",
                expertise: "Product Management",
                googleId: "google_hannah_008",
                organization: org1._id,
            },
            {
                name: "Ivan Participant",
                email: "ivan.participant@techcorp.com",
                role: "user",
                expertise: "Mobile Development",
                googleId: "google_ivan_009",
                organization: org1._id,
            },
        ]);
        org1Users.push(...org1RegularUsers);

        // Update org1 admin
        org1.admin = org1Admin._id;
        await org1.save();

        console.log(`✅ Created ${org1Users.length} users for Tech Corp`);

        // ========== ORGANIZATION 2 ==========
        console.log("\n📦 Creating Organization 2: Innovation Labs");
        const org2 = await Organization.create({
            name: "Innovation Labs",
            domain: "innovationlabs.com",
        });

        // Create users for Organization 2 (15 users to ensure enough for 2 teams)
        console.log("👥 Creating users for Innovation Labs...");
        const org2Users = [];
        
        // Admin for Org2
        const org2Admin = await User.create({
            name: "Isaac Admin",
            email: "isaac.admin@innovationlabs.com",
            role: "admin",
            expertise: "Business Strategy",
            googleId: "google_isaac_admin_010",
            organization: org2._id,
        });
        org2Users.push(org2Admin);

        // Hackathon Creators for Org2
        const org2Creator1 = await User.create({
            name: "Julia Creator",
            email: "julia.creator@innovationlabs.com",
            role: "hackathon_creator",
            expertise: "Innovation Management",
            googleId: "google_julia_creator_011",
            organization: org2._id,
        });
        org2Users.push(org2Creator1);

        const org2Creator2 = await User.create({
            name: "Kevin Creator",
            email: "kevin.creator@innovationlabs.com",
            role: "hackathon_creator",
            expertise: "Event Planning",
            googleId: "google_kevin_creator_012",
            organization: org2._id,
        });
        org2Users.push(org2Creator2);

        // Regular users for Org2
        const org2RegularUsers = await User.create([
            {
                name: "Laura Developer",
                email: "laura.dev@innovationlabs.com",
                role: "user",
                expertise: "Full Stack Development",
                googleId: "google_laura_012",
                organization: org2._id,
            },
            {
                name: "Mike Engineer",
                email: "mike.eng@innovationlabs.com",
                role: "user",
                expertise: "Cloud Architecture",
                googleId: "google_mike_013",
                organization: org2._id,
            },
            {
                name: "Nina Designer",
                email: "nina.design@innovationlabs.com",
                role: "user",
                expertise: "Graphic Design",
                googleId: "google_nina_014",
                organization: org2._id,
            },
            {
                name: "Oscar Data",
                email: "oscar.data@innovationlabs.com",
                role: "user",
                expertise: "Data Science",
                googleId: "google_oscar_015",
                organization: org2._id,
            },
            {
                name: "Paula Product",
                email: "paula.product@innovationlabs.com",
                role: "user",
                expertise: "Product Strategy",
                googleId: "google_paula_016",
                organization: org2._id,
            },
            {
                name: "Quinn QA",
                email: "quinn.qa@innovationlabs.com",
                role: "user",
                expertise: "Quality Assurance",
                googleId: "google_quinn_017",
                organization: org2._id,
            },
            {
                name: "Rachel Research",
                email: "rachel.research@innovationlabs.com",
                role: "user",
                expertise: "Research & Development",
                googleId: "google_rachel_019",
                organization: org2._id,
            },
            {
                name: "Steve Security",
                email: "steve.security@innovationlabs.com",
                role: "user",
                expertise: "Cybersecurity",
                googleId: "google_steve_020",
                organization: org2._id,
            },
            {
                name: "Tina Tech",
                email: "tina.tech@innovationlabs.com",
                role: "user",
                expertise: "Technical Writing",
                googleId: "google_tina_021",
                organization: org2._id,
            },
            {
                name: "Uma UX",
                email: "uma.ux@innovationlabs.com",
                role: "user",
                expertise: "UX Research",
                googleId: "google_uma_022",
                organization: org2._id,
            },
        ]);
        org2Users.push(...org2RegularUsers);

        // Update org2 admin
        org2.admin = org2Admin._id;
        await org2.save();

        console.log(`✅ Created ${org2Users.length} users for Innovation Labs`);

        // ========== HACKATHONS ==========
        console.log("\n🏆 Creating Hackathons...");

        // Hackathon 1 for Organization 1
        console.log("\n📌 Creating Hackathon 1 for Tech Corp");
        const hackathon1 = await Hackathon.create({
            title: "Tech Corp Innovation Challenge 2025",
            description: "Annual innovation hackathon for Tech Corp to develop cutting-edge solutions for customer problems.",
            isActive: true,
            mnimumTeamSize: 2,
            maximumTeamSize: 5,
            organization: org1._id,
            createdBy: org1Creator._id,
        });

        // Assign roles for Hackathon 1
        console.log("  👤 Assigning roles for Tech Corp Innovation Challenge...");
        await HackathonRole.create([
            {
                user: org1Creator._id,
                hackathon: hackathon1._id,
                role: "organizer",
                assignedBy: org1Admin._id,
            },
            {
                user: org1RegularUsers[5]._id, // George Mentor
                hackathon: hackathon1._id,
                role: "mentor",
                assignedBy: org1Creator._id,
            },
            {
                user: org1RegularUsers[6]._id, // Hannah Judge
                hackathon: hackathon1._id,
                role: "judge",
                assignedBy: org1Creator._id,
            },
            {
                user: org1RegularUsers[0]._id, // Charlie User
                hackathon: hackathon1._id,
                role: "participant",
                assignedBy: org1Creator._id,
            },
            {
                user: org1RegularUsers[1]._id, // Diana Developer
                hackathon: hackathon1._id,
                role: "participant",
                assignedBy: org1Creator._id,
            },
            {
                user: org1RegularUsers[2]._id, // Ethan Engineer
                hackathon: hackathon1._id,
                role: "participant",
                assignedBy: org1Creator._id,
            },
        ]);

        // Hackathon 2 for Organization 2
        console.log("\n📌 Creating Hackathon 2 for Innovation Labs");
        const hackathon2 = await Hackathon.create({
            title: "Innovation Labs AI Revolution",
            description: "Build AI-powered solutions that will transform industries and create meaningful impact.",
            isActive: true,
            mnimumTeamSize: 3,
            maximumTeamSize: 5,
            organization: org2._id,
            createdBy: org2Creator1._id,
        });

        // Assign roles for Hackathon 2
        console.log("  👤 Assigning roles for Innovation Labs AI Revolution...");
        await HackathonRole.create([
            {
                user: org2Creator1._id,
                hackathon: hackathon2._id,
                role: "organizer",
                assignedBy: org2Admin._id,
            },
            {
                user: org2RegularUsers[7]._id, // Rachel Research
                hackathon: hackathon2._id,
                role: "mentor",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[4]._id, // Paula Product
                hackathon: hackathon2._id,
                role: "judge",
                assignedBy: org2Creator1._id,
            },
            // Team 1 participants
            {
                user: org2RegularUsers[0]._id, // Laura Developer
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[1]._id, // Mike Engineer
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[2]._id, // Nina Designer
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[3]._id, // Oscar Data
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            // Team 2 participants
            {
                user: org2RegularUsers[5]._id, // Quinn QA
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[6]._id, // Steve Security
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[8]._id, // Tina Tech
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
            {
                user: org2RegularUsers[9]._id, // Uma UX
                hackathon: hackathon2._id,
                role: "participant",
                assignedBy: org2Creator1._id,
            },
        ]);

        // Hackathon 3 for Organization 2
        console.log("\n📌 Creating Hackathon 3 for Innovation Labs");
        const hackathon3 = await Hackathon.create({
            title: "Innovation Labs Green Tech Summit",
            description: "Create sustainable technology solutions for environmental challenges and climate change.",
            isActive: true,
            mnimumTeamSize: 2,
            maximumTeamSize: 4,
            organization: org2._id,
            createdBy: org2Creator2._id,
        });

        // Assign roles for Hackathon 3
        console.log("  👤 Assigning roles for Innovation Labs Green Tech Summit...");
        await HackathonRole.create([
            {
                user: org2Creator2._id,
                hackathon: hackathon3._id,
                role: "organizer",
                assignedBy: org2Admin._id,
            },
            {
                user: org2RegularUsers[8]._id, // Tina Tech
                hackathon: hackathon3._id,
                role: "mentor",
                assignedBy: org2Creator2._id,
            },
            {
                user: org2RegularUsers[9]._id, // Uma UX
                hackathon: hackathon3._id,
                role: "judge",
                assignedBy: org2Creator2._id,
            },
            {
                user: org2RegularUsers[0]._id, // Laura Developer (can participate in multiple)
                hackathon: hackathon3._id,
                role: "participant",
                assignedBy: org2Creator2._id,
            },
            {
                user: org2RegularUsers[1]._id, // Mike Engineer
                hackathon: hackathon3._id,
                role: "participant",
                assignedBy: org2Creator2._id,
            },
        ]);

        // ========== IDEAS AND TEAMS ==========
        console.log("\n💡 Creating Ideas and Teams...");

        // Create Ideas for Hackathon 2 (Innovation Labs AI Revolution)
        console.log("\n  📝 Creating ideas for AI Revolution Hackathon...");
        const idea1 = await Idea.create({
            title: "AI-Powered Healthcare Assistant",
            description: "An intelligent assistant that helps doctors diagnose diseases using machine learning and natural language processing.",
            submitter: org2RegularUsers[0]._id, // Laura Developer
            isPublic: false,
            organization: org2._id,
        });

        const idea2 = await Idea.create({
            title: "Smart City Traffic Optimizer",
            description: "AI system that optimizes traffic flow in real-time using predictive analytics and IoT sensors.",
            submitter: org2RegularUsers[5]._id, // Quinn QA
            isPublic: false,
            organization: org2._id,
        });

        // Create Team 1 for Hackathon 2
        console.log("\n  👥 Creating Team 1 for AI Revolution Hackathon...");
        const team1 = await Team.create({
            name: "AI Healthcare Innovators",
            idea: idea1._id,
            members: [
                org2RegularUsers[0]._id, // Laura Developer (leader)
                org2RegularUsers[1]._id, // Mike Engineer
                org2RegularUsers[2]._id, // Nina Designer
                org2RegularUsers[3]._id, // Oscar Data
            ],
            leader: org2RegularUsers[0]._id, // Laura Developer
            organization: org2._id,
            hackathon: hackathon2._id,
            mentor: org2RegularUsers[7]._id, // Rachel Research
        });

        // Create Team 2 for Hackathon 2
        console.log("  👥 Creating Team 2 for AI Revolution Hackathon...");
        const team2 = await Team.create({
            name: "Smart City Engineers",
            idea: idea2._id,
            members: [
                org2RegularUsers[5]._id, // Quinn QA (leader)
                org2RegularUsers[6]._id, // Steve Security
                org2RegularUsers[8]._id, // Tina Tech
                org2RegularUsers[9]._id, // Uma UX
            ],
            leader: org2RegularUsers[5]._id, // Quinn QA
            organization: org2._id,
            hackathon: hackathon2._id,
            mentor: org2RegularUsers[7]._id, // Rachel Research
        });

        // Create some public ideas
        console.log("\n  📝 Creating public ideas...");
        await Idea.create([
            {
                title: "Blockchain Supply Chain",
                description: "Transparent supply chain management using blockchain technology.",
                submitter: org1RegularUsers[0]._id,
                isPublic: true,
                organization: org1._id,
            },
            {
                title: "AR Learning Platform",
                description: "Augmented reality platform for interactive education experiences.",
                submitter: org2RegularUsers[2]._id,
                isPublic: true,
                organization: org2._id,
            },
        ]);

        // ========== SUMMARY ==========
        console.log("\n\n✅ ============ SEEDING COMPLETE ============");
        console.log("\n📊 SUMMARY:");
        console.log("─────────────────────────────────────────────");
        console.log(`\n🏢 ORGANIZATIONS CREATED: 2`);
        console.log(`   1. Tech Corp (${org1Users.length} users, 1 hackathon)`);
        console.log(`   2. Innovation Labs (${org2Users.length} users, 2 hackathons)`);
        
        console.log(`\n👥 TOTAL USERS: ${org1Users.length + org2Users.length}`);
        console.log(`   - Tech Corp: ${org1Users.length} users`);
        console.log(`   - Innovation Labs: ${org2Users.length} users`);
        
        console.log(`\n🏆 HACKATHONS CREATED: 3`);
        console.log(`   1. ${hackathon1.title}`);
        console.log(`      Organization: Tech Corp`);
        console.log(`      Roles: 1 Organizer, 1 Mentor, 1 Judge, 3 Participants`);
        console.log(`\n   2. ${hackathon2.title}`);
        console.log(`      Organization: Innovation Labs`);
        console.log(`      Roles: 1 Organizer, 1 Mentor, 1 Judge, 8 Participants`);
        console.log(`      Teams: 2 (4 members each)`);
        console.log(`\n   3. ${hackathon3.title}`);
        console.log(`      Organization: Innovation Labs`);
        console.log(`      Roles: 1 Organizer, 1 Mentor, 1 Judge, 2 Participants`);
        
        console.log(`\n👥 TEAMS CREATED: 2`);
        console.log(`   1. AI Healthcare Innovators (4 members) - Hackathon 2`);
        console.log(`   2. Smart City Engineers (4 members) - Hackathon 2`);
        
        console.log(`\n💡 IDEAS CREATED: 4`);
        console.log(`   - 2 hackathon-specific ideas`);
        console.log(`   - 2 public ideas`);
        
        console.log("\n─────────────────────────────────────────────");
        console.log("\n🔑 KEY ACCOUNTS:");
        console.log(`\nOrg 1 Admin: ${org1Admin.email}`);
        console.log(`Org 1 Creator: ${org1Creator.email}`);
        console.log(`Org 2 Admin: ${org2Admin.email}`);
        console.log(`Org 2 Creator 1: ${org2Creator1.email}`);
        console.log(`Org 2 Creator 2: ${org2Creator2.email}`);
        
        console.log("\n─────────────────────────────────────────────");
        console.log("\n📋 USER IDs FOR TEST LOGIN:");
        console.log("\n🏢 TECH CORP USERS:");
        console.log(`   ${org1Admin.name} (${org1Admin.role})`);
        console.log(`   ID: ${org1Admin._id}`);
        console.log(`\n   ${org1Creator.name} (${org1Creator.role})`);
        console.log(`   ID: ${org1Creator._id}`);
        org1RegularUsers.forEach(user => {
            console.log(`\n   ${user.name} (${user.role})`);
            console.log(`   ID: ${user._id}`);
        });
        
        console.log("\n\n🏢 INNOVATION LABS USERS:");
        console.log(`   ${org2Admin.name} (${org2Admin.role})`);
        console.log(`   ID: ${org2Admin._id}`);
        console.log(`\n   ${org2Creator1.name} (${org2Creator1.role})`);
        console.log(`   ID: ${org2Creator1._id}`);
        console.log(`\n   ${org2Creator2.name} (${org2Creator2.role})`);
        console.log(`   ID: ${org2Creator2._id}`);
        org2RegularUsers.forEach(user => {
            console.log(`\n   ${user.name} (${user.role})`);
            console.log(`   ID: ${user._id}`);
        });
        
        console.log("\n─────────────────────────────────────────────");
        console.log("\n🎯 ALL HACKATHON ROLES ASSIGNED:");
        console.log("   ✓ Organizers");
        console.log("   ✓ Judges");
        console.log("   ✓ Mentors");
        console.log("   ✓ Participants");
        console.log("\n✨ Database is now fully populated with test data!");
        console.log("─────────────────────────────────────────────");
        console.log("\n💡 TIP: Use the Test Login Panel on the login page");
        console.log("   to quickly switch between users in development mode!");
        console.log("\n─────────────────────────────────────────────\n");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error seeding data:", error);
        process.exit(1);
    }
};

// Run the seed script
seedData();

