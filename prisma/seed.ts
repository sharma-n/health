// Seed the shared system-exercise library (SPEC.md §9.1). System exercises have
// `isSystem = true` and `ownerId = null`; they are readable by every user and
// read-only (an "edit" clones an owned copy — Milestone 3).
//
// Idempotent: re-running inserts only the exercises that are missing, so it is
// safe to run on every container start. The partial unique index
// `Exercise_system_name_key` (ON "Exercise"("name") WHERE isSystem) is the
// DB-level safety net; this script's find-or-create is the app-level guard.
//
// Run with `npx prisma db seed` (wired in prisma.config.ts) or `npm run db:seed`.

import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import type { Equipment, MuscleGroup } from "../src/lib/constants";

type SeedExercise = {
  name: string;
  equipment: Equipment;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  description?: string;
  instructions?: string;
  commonPitfalls?: string;
};

// The system exercise library — a covering set of ~40 core movements across
// all equipment types and muscle groups. Curation: focus on compound movements,
// essentials, and common accessories; lean toward what a home or commercial gym
// would stock. Each exercise explicitly lists primary and secondary targets.
const SYSTEM_EXERCISES: SeedExercise[] = [
  // Barbell
  {
    name: "Barbell Bench Press",
    equipment: "BARBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Classic pressing movement; the primary chest builder.",
    instructions: "Lie flat on bench, grip bar slightly wider than shoulder-width. Unrack and lower bar to mid-chest under control. Press back up to full extension.",
    commonPitfalls: "Bouncing the bar off the chest. Flaring elbows too wide (90°). Lifting hips off the bench. Using too much weight before mastering form.",
  },
  {
    name: "Barbell Back Squat",
    equipment: "BARBELL",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Compound leg movement; heavy quad focus with posterior chain involvement.",
    instructions: "Position bar on upper traps, feet shoulder-width apart. Brace core, push knees out, descend until hips are below parallel. Drive through heels to stand.",
    commonPitfalls: "Knees caving inward (valgus collapse). Heels rising (fix: raise heels on plates or work ankle mobility). Forward torso lean. Squatting to depth without hip flexibility.",
  },
  {
    name: "Barbell Deadlift",
    equipment: "BARBELL",
    primaryMuscles: ["GLUTES", "HAMSTRINGS"],
    secondaryMuscles: ["BACK", "QUADS"],
    description: "Full-body compound; the ultimate posterior chain builder.",
    instructions: "Stand with bar over mid-foot, hip-width stance. Hinge at hips, grip just outside legs. Brace, then drive floor away while keeping bar close. Lock out hips and knees together.",
    commonPitfalls: "Rounding the lower back under load. Bar drifting away from legs. Jerking the bar off the floor. Hyperextending at lockout.",
  },
  {
    name: "Barbell Bent-Over Row",
    equipment: "BARBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "Classic back thickness builder; compound pulling movement.",
    instructions: "Hinge forward ~45°, bar hanging from fully extended arms. Row bar to lower chest/navel by driving elbows back and up. Lower under control.",
    commonPitfalls: "Using too much body English / momentum. Raising torso on each rep. Pulling to the wrong part of the torso. Letting shoulder blades flare instead of retracting.",
  },
  {
    name: "Barbell Overhead Press",
    equipment: "BARBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS", "CHEST"],
    description: "Standing overhead press; primary shoulder strength developer.",
    instructions: "Stand, grip bar just outside shoulders. Press bar straight up, pushing head through at the top. Lower back to clavicle under control.",
    commonPitfalls: "Excessive lower-back arch. Bar path drifting forward. Not locking out elbows at the top. Performing a slow push press instead of a strict press.",
  },
  {
    name: "Barbell Curl",
    equipment: "BARBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Isolation bicep exercise; classic arm builder.",
    instructions: "Stand, underhand grip shoulder-width. Keeping upper arms stationary, curl bar to shoulder height. Squeeze biceps at top, lower slowly.",
    commonPitfalls: "Swinging the torso to initiate each rep. Upper arms drifting forward. Dropping the weight on the way down instead of lowering with control.",
  },

  // Dumbbell
  {
    name: "Dumbbell Bench Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Dumbbells allow a greater range of motion than barbell pressing.",
    instructions: "Lie on bench, dumbbells at chest level. Press up and slightly inward until arms are fully extended. Lower with control, allowing a slight stretch at the bottom.",
    commonPitfalls: "Letting the dumbbells drift too far apart at the top. Losing shoulder stability by going too heavy. Not getting the full stretch at the bottom.",
  },
  {
    name: "Dumbbell Rows",
    equipment: "DUMBBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "One-arm rows; unilateral back and lat development.",
    instructions: "Place one knee and hand on bench. Hold dumbbell in opposite hand. Row dumbbell to hip/lower rib, driving elbow back. Keep torso flat.",
    commonPitfalls: "Rotating the torso (using rotation rather than the lat). Shrugging the shoulder at the top instead of retracting the scapula. Pulling toward the shoulder rather than the hip.",
  },
  {
    name: "Dumbbell Shoulder Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Bilateral shoulder pressing with dumbbells; stability challenge.",
    instructions: "Seated or standing, hold dumbbells at ear height with elbows at 90°. Press directly overhead to full extension. Lower back to start.",
    commonPitfalls: "Pressing the dumbbells forward rather than directly up. Arching the lower back excessively. Not fully extending at the top.",
  },
  {
    name: "Dumbbell Flyes",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Isolation chest movement; excellent pec stretch and activation.",
    instructions: "Lie on bench, dumbbells extended above chest with slight bend in elbows. Lower arms in a wide arc until chest stretches. Squeeze pecs to bring dumbbells back together.",
    commonPitfalls: "Bending elbows too much (turns into a press). Going so heavy the shoulder joint is stressed. Locking elbows straight.",
  },
  {
    name: "Dumbbell Curls",
    equipment: "DUMBBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Classic arm isolation; two-arm bicep builder.",
    instructions: "Stand or sit, dumbbells hanging at sides. Curl both dumbbells (or alternate) to shoulder height with palms facing up. Lower with control.",
    commonPitfalls: "Wrist deviation at the top. Swinging the weights up. Not supinating (rotating palm up) during the lift.",
  },
  {
    name: "Dumbbell Lateral Raise",
    equipment: "DUMBBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRAPS"],
    description: "Side delt isolation; crucial for shoulder width.",
    instructions: "Hold dumbbells at sides. Raise arms out to the side to shoulder height, leading with elbows, thumbs slightly down. Lower slowly.",
    commonPitfalls: "Using too much weight and shrugging traps to lift. Raising arms above shoulder height. Swinging the dumbbells rather than a controlled raise.",
  },
  {
    name: "Dumbbell Goblet Squat",
    equipment: "DUMBBELL",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Unloaded squat variation; mobility and leg development.",
    instructions: "Hold a dumbbell vertically at chest height. Squat with feet slightly wider than shoulder-width. Descend between knees to depth, keeping chest tall. Drive through heels to stand.",
    commonPitfalls: "Letting elbows cave inward. Heels rising off the floor. Rounding the upper back. Not reaching full depth.",
  },
  {
    name: "Dumbbell Tricep Extension",
    equipment: "DUMBBELL",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Overhead tricep isolation; lockout strength builder.",
    instructions: "Hold one dumbbell overhead with both hands. Keeping upper arms vertical, lower the dumbbell behind your head. Extend back to full lockout.",
    commonPitfalls: "Flaring elbows out to the side. Moving upper arms rather than only bending at the elbow. Using too heavy a weight and losing range of motion.",
  },

  // Machine
  {
    name: "Leg Press",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Lower body pressing machine; heavy quad focus.",
    instructions: "Sit in machine, feet shoulder-width on platform. Lower platform by bending knees toward chest, stopping before hips lift. Press to near-full extension.",
    commonPitfalls: "Locking knees out completely at the top (risk to joint). Allowing hips to lift off the seat (lower back rounding). Feet placement too high or too low.",
  },
  {
    name: "Chest Press Machine",
    equipment: "MACHINE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS"],
    description: "Guided pressing movement; stable chest development.",
    instructions: "Adjust seat so handles are at chest height. Grip handles and press forward to near-full arm extension. Return under control.",
    commonPitfalls: "Arching the lower back off the pad. Allowing the weight stack to crash on return. Gripping too wide causing shoulder discomfort.",
  },
  {
    name: "Lat Pulldown",
    equipment: "MACHINE",
    primaryMuscles: ["LATS"],
    secondaryMuscles: ["BICEPS", "BACK"],
    description: "Vertical pulling machine; lat width and back thickness.",
    instructions: "Sit with knees under pads, grip bar wider than shoulders. Pull bar to upper chest by driving elbows down and back. Squeeze lats. Return with control.",
    commonPitfalls: "Leaning back too far (becomes a row). Pulling behind the neck (cervical risk). Using momentum to jerk the weight down.",
  },
  {
    name: "Leg Curl",
    equipment: "MACHINE",
    primaryMuscles: ["HAMSTRINGS"],
    secondaryMuscles: ["GLUTES"],
    description: "Hamstring isolation; knee flexion movement.",
    instructions: "Lie face down on machine, pad resting just above heels. Curl legs toward glutes through full range. Lower slowly.",
    commonPitfalls: "Hips rising off the pad (reduces hamstring isolation). Partial range of motion. Letting the weight drop quickly on the way down.",
  },
  {
    name: "Leg Extension",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: [],
    description: "Quadriceps isolation; knee extension machine.",
    instructions: "Sit in machine, pad resting on shins just above ankles. Extend legs to full knee extension. Lower slowly without letting the stack touch.",
    commonPitfalls: "Using excessive weight that causes knee strain. Lifting hips off the seat. Not controlling the eccentric (lowering) phase.",
  },
  {
    name: "Shoulder Press Machine",
    equipment: "MACHINE",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Seated or standing shoulder press; controlled overhead pressing.",
    instructions: "Adjust seat so handles are at shoulder height. Press upward to full extension without locking elbows. Lower to start.",
    commonPitfalls: "Seat too low causing shoulder impingement. Pressing to full lockout and stressing the joint. Using momentum to push the weight up.",
  },

  // Cable
  {
    name: "Cable Chest Flyes",
    equipment: "CABLE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Constant tension chest isolation; pec pump.",
    instructions: "Set cables at shoulder height. Stand in the middle and hold handles with arms slightly bent. Bring hands together in front of chest in a hugging arc. Return with control.",
    commonPitfalls: "Straightening the arms (turning into a press). Letting the cables pull arms too far back past the chest line. Leaning too far forward.",
  },
  {
    name: "Cable Rows",
    equipment: "CABLE",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "Horizontal pulling cable movement; back and lat development.",
    instructions: "Sit at cable row station, feet on platform. Pull handle to abdomen by driving elbows back and squeezing shoulder blades. Keep torso upright.",
    commonPitfalls: "Rocking the torso forward and back with each rep. Shrugging shoulders instead of retracting scapulae. Pulling to the wrong height.",
  },
  {
    name: "Cable Bicep Curls",
    equipment: "CABLE",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Constant tension bicep isolation; full range activation.",
    instructions: "Stand at low cable, underhand grip on bar or rope. Keeping elbows at sides, curl to shoulder height. Squeeze biceps at top. Lower slowly.",
    commonPitfalls: "Pulling elbows forward during the curl. Using body swing. Not fully extending at the bottom to take advantage of constant cable tension.",
  },
  {
    name: "Cable Tricep Pushdown",
    equipment: "CABLE",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Tricep isolation at the cable stack; arm finisher.",
    instructions: "Stand at high cable with rope or bar. Tuck elbows to sides. Extend arms fully downward by contracting triceps. Return to 90° at elbows.",
    commonPitfalls: "Allowing elbows to flare and drift forward. Leaning heavily over the cable. Not achieving full extension at the bottom.",
  },

  // Kettlebell
  {
    name: "Kettlebell Swing",
    equipment: "KETTLEBELL",
    primaryMuscles: ["GLUTES", "HAMSTRINGS"],
    secondaryMuscles: ["BACK", "SHOULDERS"],
    description: "Explosive hip hinge; posterior chain power and endurance.",
    instructions: "Stand with feet shoulder-width, KB between feet. Hinge hips, grip KB. Drive hips forward explosively to swing KB to shoulder height. Hinge back and repeat.",
    commonPitfalls: "Squatting instead of hinging. Using the arms to lift the kettlebell rather than hip drive. Hyperextending the back at the top.",
  },
  {
    name: "Kettlebell Turkish Get-up",
    equipment: "KETTLEBELL",
    primaryMuscles: ["SHOULDERS", "CHEST"],
    secondaryMuscles: ["ABS", "GLUTES"],
    description: "Complex multi-joint movement; full-body strength and stability.",
    instructions: "Lie with KB in one hand extended. Roll to elbow, then hand. Sweep leg through to lunge position. Stand up. Reverse the sequence to return to floor.",
    commonPitfalls: "Rushing the movement. Losing eye contact with the KB at any stage. Not stabilising the shoulder before each transition.",
  },

  // Bodyweight
  {
    name: "Push-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Classic pressing movement; no equipment needed.",
    instructions: "Start in high plank, hands slightly wider than shoulders. Lower chest to floor by bending elbows at ~45°. Push back to full extension.",
    commonPitfalls: "Hips sagging or piking up. Elbows flaring out at 90°. Not reaching full range (partial reps). Head dropping forward.",
  },
  {
    name: "Pull-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["LATS"],
    secondaryMuscles: ["BICEPS", "BACK"],
    description: "Vertical pulling; compound back and arm builder.",
    instructions: "Hang from bar with overhand grip, shoulder-width. Pull body up by driving elbows down toward hips until chin clears bar. Lower fully.",
    commonPitfalls: "Kipping (swinging) instead of controlled movement. Not fully extending arms at the bottom (dead hang). Shrugging shoulders rather than engaging lats.",
  },
  {
    name: "Dips",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["TRICEPS", "CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Compound pressing movement; chest and arm focus.",
    instructions: "Support on parallel bars with arms extended. Lower body by bending elbows until upper arms are parallel to floor. Press back to full extension.",
    commonPitfalls: "Leaning too far forward (shifts emphasis to chest excessively). Not descending to 90° at the elbow. Locking out elbows violently at the top.",
  },
  {
    name: "Bodyweight Squats",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Leg movement with zero equipment; endurance and form work.",
    instructions: "Feet shoulder-width, toes slightly out. Arms forward for balance. Descend by pushing knees out and hinging hips until thighs are parallel. Stand back up.",
    commonPitfalls: "Knees caving inward. Heels rising. Excessive forward torso lean. Stopping above parallel.",
  },
  {
    name: "Lunges",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Single-leg movement; balance and unilateral leg development.",
    instructions: "Stand tall. Step forward and lower the rear knee toward the floor. Both knees at ~90°. Push through front heel to return to standing.",
    commonPitfalls: "Front knee tracking over toes (should stay behind toes). Torso leaning forward. Taking too short a step. Losing balance by looking down.",
  },
  {
    name: "Planks",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: ["OBLIQUES"],
    description: "Core isometric hold; stability and endurance.",
    instructions: "Forearms on floor, elbows under shoulders. Feet hip-width. Brace core and glutes to create a straight line from head to heels. Hold.",
    commonPitfalls: "Hips sagging toward the floor. Hips piking up in the air. Holding breath. Neck dropping or raising.",
  },
  {
    name: "Crunches",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: [],
    description: "Isolation abdominal flexion; upper ab focus.",
    instructions: "Lie on back, knees bent, feet flat. Place hands behind ears. Curl shoulders off floor by flexing abs, not pulling the neck. Lower slowly.",
    commonPitfalls: "Pulling on the neck with hands. Using momentum to jerk up. Lifting all the way to a full sit-up (takes load off abs).",
  },
  {
    name: "Chin-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["LATS", "BACK"],
    description: "Supinated pull-up; stronger bicep involvement than pull-ups.",
    instructions: "Hang from bar with underhand grip, hands shoulder-width. Pull body up until chin clears the bar. Lower fully to dead hang.",
    commonPitfalls: "Narrow grip causing wrist discomfort. Not achieving full hang at the bottom. Using kipping motion rather than controlled pull.",
  },

  // Bands
  {
    name: "Resistance Band Rows",
    equipment: "BAND",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS"],
    description: "Portable pulling movement; back and arm development.",
    instructions: "Anchor band at waist height. Hold handles with underhand or neutral grip. Step back for tension. Row handles to abdomen, driving elbows back.",
    commonPitfalls: "Letting the band snap arms forward (control the return). Rocking the torso. Insufficient band tension making the movement too easy.",
  },
  {
    name: "Resistance Band Chest Press",
    equipment: "BAND",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS"],
    description: "Band pressing; variable resistance chest work.",
    instructions: "Anchor band behind you at chest height. Hold handles and step forward for tension. Press hands forward and slightly inward to full extension.",
    commonPitfalls: "Not stepping far enough forward for adequate resistance. Letting elbows drop below chest level. Releasing tension on the return.",
  },
  {
    name: "Resistance Band Curls",
    equipment: "BAND",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: [],
    description: "Band isolation for biceps; portable arm training.",
    instructions: "Stand on the middle of the band, hold handles underhand. Keeping upper arms stationary, curl handles to shoulder height. Lower slowly.",
    commonPitfalls: "Band slipping underfoot. Swinging the torso. Using too light a band and losing time under tension.",
  },

  // Additional exercises for fuller muscle coverage
  // Barbell variations
  {
    name: "Barbell Incline Bench Press",
    equipment: "BARBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS", "TRICEPS"],
    description: "Incline pressing; upper chest and front delt emphasis.",
    instructions: "Set bench to 30–45° incline. Press bar from upper chest to full extension. Lower to chest.",
    commonPitfalls: "Incline too steep causing shoulder impingement. Bar path drifting forward. Excessive arch.",
  },
  {
    name: "Barbell Front Squat",
    equipment: "BARBELL",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "ABS"],
    description: "Front rack squat; upright quad-dominant movement.",
    instructions: "Bar across front delts and shoulders. Squat to depth keeping torso upright. Drive through heels.",
    commonPitfalls: "Elbows dropping forward. Excessive forward lean. Bar rolling off shoulders.",
  },
  {
    name: "Barbell Romanian Deadlift",
    equipment: "BARBELL",
    primaryMuscles: ["HAMSTRINGS", "BACK"],
    secondaryMuscles: ["GLUTES"],
    description: "Hip hinge with straight legs; posterior chain stretch and strength.",
    instructions: "Bar in hands at thigh level, slight knee bend. Hinge at hips, lowering bar down shins while keeping torso straight. Return to standing.",
    commonPitfalls: "Rounding the lower back. Excessive knee bend. Not feeling the hamstring stretch.",
  },
  {
    name: "Barbell Pendlay Row",
    equipment: "BARBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "Explosive chest-supported row; power and thickness.",
    instructions: "Bend to 45°, bar touching chest. Drive bar explosively into your chest. Control the descent.",
    commonPitfalls: "Using too much momentum. Hyperextending at the top. Insufficient chest support.",
  },
  {
    name: "Barbell Sumo Deadlift",
    equipment: "BARBELL",
    primaryMuscles: ["GLUTES", "HAMSTRINGS"],
    secondaryMuscles: ["QUADS", "BACK"],
    description: "Wide-stance deadlift; glute and inner thigh emphasis.",
    instructions: "Wider than shoulder-width stance, toes out 30°. Bar over mid-foot. Drive floor away to lockout.",
    commonPitfalls: "Knees not tracking toes. Heels raising. Bar drifting away from body.",
  },
  {
    name: "Barbell Hack Squat (on machine or with bar)",
    equipment: "BARBELL",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES"],
    description: "Machine squat variation; quad isolation with reduced lower back stress.",
    instructions: "On machine or behind back with bar. Squat to depth. Press through midfoot to stand.",
    commonPitfalls: "Knees caving. Heels rising. Not reaching full depth.",
  },
  {
    name: "Barbell Good Morning",
    equipment: "BARBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["HAMSTRINGS", "GLUTES"],
    description: "Back hyperextension with bar; posterior chain strength.",
    instructions: "Bar on shoulders. Hinge forward to 45° keeping legs straight. Return to standing.",
    commonPitfalls: "Rounding the lower back excessively. Using too much weight. Jerky movement.",
  },

  // Dumbbell variations
  {
    name: "Dumbbell Incline Bench Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS", "TRICEPS"],
    description: "Incline dumbbell pressing; upper chest development.",
    instructions: "On incline bench, press dumbbells from shoulder level. Full extension, lower with control.",
    commonPitfalls: "Dumbbells drifting too wide. Losing shoulder stability. Not getting the full stretch.",
  },
  {
    name: "Dumbbell Decline Bench Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS"],
    description: "Decline dumbbell pressing; lower chest emphasis.",
    instructions: "On decline bench, press dumbbells from chest. Press to full extension.",
    commonPitfalls: "Dumbbells too wide. Letting dumbbells drift too far back. Lacking control.",
  },
  {
    name: "Dumbbell Romanian Deadlift",
    equipment: "DUMBBELL",
    primaryMuscles: ["HAMSTRINGS", "BACK"],
    secondaryMuscles: ["GLUTES"],
    description: "Single-leg or bilateral RDL; hamstring and lower back strength.",
    instructions: "Dumbbells in hands, slight knee bend. Hinge at hips, lowering dumbbells to shins. Return to standing.",
    commonPitfalls: "Rounding the lower back. Excessive knee bend. Not feeling hamstring engagement.",
  },
  {
    name: "Dumbbell Bulgarian Split Squat",
    equipment: "DUMBBELL",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Single-leg squat variation; balance and unilateral strength.",
    instructions: "Rear foot elevated on bench, front foot forward. Holding dumbbells, lower front knee to 90°. Press to stand.",
    commonPitfalls: "Front knee tracking over toes (should be behind). Leaning too far forward. Stepping too close to bench.",
  },
  {
    name: "Dumbbell Pullover",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["LATS", "SHOULDERS"],
    description: "Chest and lat stretching movement; unique range of motion.",
    instructions: "Perpendicular to bench, upper back on bench. Dumbbell above chest with slight bend. Lower over and behind you in an arc. Return.",
    commonPitfalls: "Arms bending too much. Not getting the full stretch. Using too heavy a weight.",
  },
  {
    name: "Dumbbell Renegade Row",
    equipment: "DUMBBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["CHEST", "ABS", "BICEPS"],
    description: "Plank-position rowing; core and back integration.",
    instructions: "High plank on dumbbells. Row one dumbbell to hip while stabilizing with other arm. Alternate sides.",
    commonPitfalls: "Hips rotating or dropping. Dumbbells moving. Using too heavy a weight and losing stability.",
  },
  {
    name: "Dumbbell Alternating Curl",
    equipment: "DUMBBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Alternating bicep curl; unilateral arm development.",
    instructions: "Dumbbells at sides. Curl one dumbbell to shoulder while rotating forearm. Alternate arms.",
    commonPitfalls: "Wrist deviation. Using momentum. Not achieving full range of motion.",
  },
  {
    name: "Dumbbell Hammer Curls",
    equipment: "DUMBBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS", "BICEPS"],
    description: "Neutral-grip curls; brachialis and bicep development.",
    instructions: "Dumbbells at sides, neutral grip (palms facing each other). Curl to shoulder height. Lower with control.",
    commonPitfalls: "Rotating the wrist during the curl. Using momentum. Letting elbows drift forward.",
  },
  {
    name: "Dumbbell Kickbacks",
    equipment: "DUMBBELL",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Tricep isolation; arm finisher.",
    instructions: "Bent over 45°, elbow bent at 90°. Extend arm straight back by contracting triceps. Return to 90°.",
    commonPitfalls: "Using momentum to swing. Elbows rising. Using too much weight and losing the squeeze.",
  },
  {
    name: "Dumbbell Overhead Carry",
    equipment: "DUMBBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["ABS", "TRAPS"],
    description: "Loaded carry; shoulder stability and core strength.",
    instructions: "Hold dumbbell overhead with one arm, locked out. Walk for distance, keeping core tight.",
    commonPitfalls: "Dumbbell drifting forward. Leaning away to compensate. Shoulder dropping.",
  },

  // Machine exercises
  {
    name: "Hack Squat Machine",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES"],
    description: "Machine-guided squat; reduced balance demand.",
    instructions: "Back and shoulders on pads, feet shoulder-width on platform. Lower until knees are at 90°. Press to stand.",
    commonPitfalls: "Knees caving inward. Heels rising. Not reaching full depth.",
  },
  {
    name: "Smith Machine Bench Press",
    equipment: "MACHINE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Smith machine pressing; stability aid for free-weight movements.",
    instructions: "Adjust bar to chest height. Unrack and press to full extension. Lower under control.",
    commonPitfalls: "Bar path not vertical (using the rails incorrectly). Excessive arch. Uncontrolled descent.",
  },
  {
    name: "Pendulum Squat",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Pendulum machine movement; hip-friendly leg press variation.",
    instructions: "Sit in machine, feet on platform. Lower by bending knees. Press to near-full extension.",
    commonPitfalls: "Hip position too high or low. Knees tracking inward. Using excessive weight.",
  },
  {
    name: "V-Squat Machine",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Angled squat machine; unique movement angle.",
    instructions: "Position in machine with shoulders on pads. Squat to depth. Press to standing.",
    commonPitfalls: "Not reaching adequate depth. Knees caving. Uneven weight distribution.",
  },
  {
    name: "Seated Leg Press",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Seated leg pressing machine; quad and lower body focus.",
    instructions: "Sit in machine, feet on platform at shoulder-width. Push away to near-full extension. Lower with control.",
    commonPitfalls: "Locking knees at the top. Hips lifting off the seat. Feet placed too high or too low.",
  },
  {
    name: "Seated Calf Raise Machine",
    equipment: "MACHINE",
    primaryMuscles: ["CALVES"],
    secondaryMuscles: [],
    description: "Isolated calf machine; soleus emphasis.",
    instructions: "Sit in machine, balls of feet on platform, knees under pads. Raise heels up. Lower with control.",
    commonPitfalls: "Not getting full range of motion. Using momentum. Insufficient weight.",
  },
  {
    name: "Standing Calf Raise Machine",
    equipment: "MACHINE",
    primaryMuscles: ["CALVES"],
    secondaryMuscles: [],
    description: "Standing calf machine; gastrocnemius emphasis.",
    instructions: "Stand under pads, balls of feet on platform. Rise up on toes. Lower with control.",
    commonPitfalls: "Not achieving full range. Using momentum. Allowing knees to bend.",
  },
  {
    name: "Machine Back Hyper Extension",
    equipment: "MACHINE",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["HAMSTRINGS", "GLUTES"],
    description: "Lower back extension machine; posterior chain strengthening.",
    instructions: "Position torso on machine, legs extended. Raise torso up at the hips. Lower back to start.",
    commonPitfalls: "Hyperextending beyond neutral. Using momentum. Not achieving full range.",
  },
  {
    name: "Machine Chest Fly",
    equipment: "MACHINE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Machine chest isolation; constant tension fly.",
    instructions: "Sit upright, handles at chest height. Bring handles together in front of chest. Return slowly.",
    commonPitfalls: "Letting handles go too far back. Leaning back excessively. Using momentum.",
  },

  // Cable exercises
  {
    name: "Cable Lateral Raise",
    equipment: "CABLE",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRAPS"],
    description: "Cable side delt isolation; constant tension raise.",
    instructions: "Stand with cable on one side, handle at waist. Raise arm out to shoulder height. Lower slowly.",
    commonPitfalls: "Using too much momentum. Raising arm above shoulder. Shrugging the shoulder.",
  },
  {
    name: "Cable Kickback",
    equipment: "CABLE",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Tricep isolation via cable; consistent resistance.",
    instructions: "Face machine, single handle attachment at lower pulley. Hinge at hips slightly, elbow bent. Extend arm back.",
    commonPitfalls: "Elbows rising. Using momentum. Not achieving full range.",
  },
  {
    name: "Cable Woodchop",
    equipment: "CABLE",
    primaryMuscles: ["OBLIQUES", "ABS"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Rotational core movement; anti-rotation stability.",
    instructions: "Stand perpendicular to cable at chest height. Rotate torso, bringing handle across your body. Return with control.",
    commonPitfalls: "Using momentum instead of core rotation. Feet staying planted. Excessive lumbar rotation.",
  },
  {
    name: "Cable Pallof Press",
    equipment: "CABLE",
    primaryMuscles: ["ABS", "OBLIQUES"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Anti-rotational core exercise; stability and control.",
    instructions: "Stand perpendicular to cable at chest height. Press handle straight out, resisting rotation. Return.",
    commonPitfalls: "Rotating the torso away from the cable. Not fully extending. Using momentum.",
  },

  // Kettlebell exercises
  {
    name: "Kettlebell Goblet Squat",
    equipment: "KETTLEBELL",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Held kettlebell squat; mobility and depth friendly.",
    instructions: "Hold kettlebell at chest level vertically. Squat to depth with elbows inside knees. Stand up.",
    commonPitfalls: "Letting elbows wing out. Heels rising. Rounding upper back.",
  },
  {
    name: "Kettlebell Suitcase Carry",
    equipment: "KETTLEBELL",
    primaryMuscles: ["OBLIQUES", "ABS"],
    secondaryMuscles: ["TRAPS"],
    description: "Loaded unilateral carry; core and spinal stability.",
    instructions: "Hold kettlebell in one hand at side. Walk for distance, keeping torso upright.",
    commonPitfalls: "Leaning away from the weight. Shoulder dropping. Rotating the torso.",
  },

  // Bodyweight exercises
  {
    name: "Diamond Push-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: ["CHEST"],
    description: "Hands-together push-up; tricep emphasis.",
    instructions: "Hands close together under chest forming diamond. Lower chest to hands. Press back up.",
    commonPitfalls: "Elbows flaring out. Hips sagging. Partial range of motion.",
  },
  {
    name: "Wide-Grip Push-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Wide-hand push-up; chest and shoulder emphasis.",
    instructions: "Hands wide of shoulders. Lower chest to floor. Press back up.",
    commonPitfalls: "Hands too far apart straining shoulders. Hips sagging. Rushing reps.",
  },
  {
    name: "Pike Push-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Elevated hip push-up; shoulder pressing variation.",
    instructions: "High plank with hips raised, body in inverted V. Lower crown of head toward floor. Press back.",
    commonPitfalls: "Hips too low (becomes a regular push-up). Head position forward. Insufficient range.",
  },
  {
    name: "Reverse Grip Chin-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["LATS", "BACK"],
    description: "Underhand pull-up; maximum bicep focus.",
    instructions: "Hang underhand, shoulder-width. Pull up until chin clears bar. Lower to dead hang.",
    commonPitfalls: "Narrow grip. Not fully extending at the bottom. Kipping movement.",
  },
  {
    name: "Hanging Leg Raises",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: ["ABS", "QUADS"],
    description: "Suspended core exercise; lower ab and hip flexor work.",
    instructions: "Hang from bar. Raise legs to horizontal or higher by contracting abs. Lower slowly.",
    commonPitfalls: "Swinging the legs. Using momentum. Not controlling the descent.",
  },
  {
    name: "Decline Sit-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: ["QUADS"],
    description: "Decline bench sit-up; heavy abdominal emphasis.",
    instructions: "On decline bench, knees bent, feet anchored. Raise torso to 45–90°. Lower slowly.",
    commonPitfalls: "Jerky movement using momentum. Pulling the neck. Using hip flexors instead of abs.",
  },
  {
    name: "Side Planks",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["OBLIQUES"],
    secondaryMuscles: ["ABS"],
    description: "Lateral core hold; oblique and stability work.",
    instructions: "Side elbow plank on forearm and outer foot. Keep hips level, body in straight line. Hold.",
    commonPitfalls: "Hips dropping or rising. Torso rotating. Holding breath.",
  },
  {
    name: "Superman Holds",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["GLUTES"],
    description: "Prone back extension hold; lower back and glute activation.",
    instructions: "Lie prone, arms extended overhead. Raise chest and legs off floor simultaneously. Hold.",
    commonPitfalls: "Jerky movement. Hyperextending the lower back. Not raising high enough.",
  },
  {
    name: "Glute Bridges",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["GLUTES"],
    secondaryMuscles: ["HAMSTRINGS", "BACK"],
    description: "Supine hip extension; glute activation and strength.",
    instructions: "Lie on back, knees bent, feet under knees. Push through heels to raise hips. Squeeze glutes at top.",
    commonPitfalls: "Using lower back instead of glutes. Not achieving full extension. Feet too far or close.",
  },
  {
    name: "Single-Leg Glute Bridge",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Unilateral glute exercise; balance and strength development.",
    instructions: "Lie on back, one leg bent, other leg extended. Push through bent leg to raise hips. Hold at top.",
    commonPitfalls: "Hips rotating. Pushing through the extended leg. Not achieving full range.",
  },
  {
    name: "Wall Sits",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES"],
    description: "Isometric quad hold; time under tension leg burner.",
    instructions: "Back against wall, feet shoulder-width, slide down to 90° at knees. Hold position.",
    commonPitfalls: "Knees caving inward. Sliding up. Feet too far from wall.",
  },
  {
    name: "Mountain Climbers",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: ["SHOULDERS", "ABS"],
    description: "Dynamic plank variation; core and cardiovascular work.",
    instructions: "High plank position. Rapidly drive knees toward chest alternately. Keep hips level.",
    commonPitfalls: "Hips piking up. Bouncing. Touching heels down.",
  },
  {
    name: "Burpees",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["CHEST", "QUADS"],
    secondaryMuscles: ["ABS", "SHOULDERS"],
    description: "Full-body explosive movement; cardio and strength.",
    instructions: "From standing, drop to push-up position, lower to floor, jump back, stand. Jump at the top.",
    commonPitfalls: "Incomplete push-ups. Lazy landings. Losing form due to fatigue.",
  },

  // Barbell leg isolation
  {
    name: "Barbell Leg Press",
    equipment: "BARBELL",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Machine leg press variations; quad-dominant pressing.",
    instructions: "Load bar on machine, feet on platform. Lower bar to knees. Press to extension.",
    commonPitfalls: "Knees caving. Hips lifting off. Insufficient depth.",
  },
  {
    name: "Barbell Calf Raise",
    equipment: "BARBELL",
    primaryMuscles: ["CALVES"],
    secondaryMuscles: [],
    description: "Free-weight calf raise; loaded gastrocnemius work.",
    instructions: "Bar on shoulders, feet hip-width. Rise up onto balls of feet. Lower with control.",
    commonPitfalls: "Not achieving full range. Using momentum. Insufficient weight.",
  },

  // Dumbbell lower body
  {
    name: "Dumbbell Step-ups",
    equipment: "DUMBBELL",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Single-leg stepping movement; unilateral leg development.",
    instructions: "Hold dumbbells, step onto bench with front leg. Drive through front heel to stand. Lower back down.",
    commonPitfalls: "Not using front leg power. Leaning forward. Knee valgus collapse.",
  },
  {
    name: "Dumbbell Calf Raises",
    equipment: "DUMBBELL",
    primaryMuscles: ["CALVES"],
    secondaryMuscles: [],
    description: "Dumbbell loaded calf raises; portable calf training.",
    instructions: "Hold dumbbells at sides, feet hip-width. Rise onto toes. Lower slowly.",
    commonPitfalls: "Not achieving full range. Losing balance. Momentum instead of control.",
  },

  // Band exercises
  {
    name: "Resistance Band Pull-aparts",
    equipment: "BAND",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["SHOULDERS", "SHOULDERS"],
    description: "Band rear delt and back fly; shoulder health accessory.",
    instructions: "Hold band at chest height, arms extended. Pull band apart, squeezing shoulder blades. Return.",
    commonPitfalls: "Band too loose (insufficient tension). Moving arms too wide. Losing posture.",
  },
  {
    name: "Resistance Band Overhead Press",
    equipment: "BAND",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Band overhead pressing; variable resistance shoulder work.",
    instructions: "Stand on band, hold handles at shoulders. Press overhead to full extension. Lower slowly.",
    commonPitfalls: "Band rolling off feet. Arching the lower back. Pressing forward instead of up.",
  },
  {
    name: "Resistance Band Face Pulls",
    equipment: "BAND",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["BACK", "SHOULDERS"],
    description: "Rear delt and shoulder health movement; rotator cuff work.",
    instructions: "Anchor band at eye height. Pull band toward face, spreading hands apart. Squeeze shoulder blades.",
    commonPitfalls: "Band too loose. Not achieving full range. Using traps instead of rear delts.",
  },
  {
    name: "Resistance Band Lateral Walks",
    equipment: "BAND",
    primaryMuscles: ["GLUTES"],
    secondaryMuscles: ["QUADS", "GLUTES"],
    description: "Banded lateral walk; hip activation and glute work.",
    instructions: "Band around thighs just above knees. Slight crouch, step laterally keeping tension. Step for reps.",
    commonPitfalls: "Band slipping down. Knees rotating inward. Insufficient tension.",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    let created = 0;
    for (const ex of SYSTEM_EXERCISES) {
      const existing = await prisma.exercise.findFirst({
        where: { name: ex.name, isSystem: true },
        select: { id: true },
      });
      if (existing) {
        await prisma.exercise.update({
          where: { id: existing.id },
          data: {
            instructions: ex.instructions ?? null,
            commonPitfalls: ex.commonPitfalls ?? null,
          },
        });
      } else {
        await prisma.exercise.create({
          data: {
            isSystem: true,
            ownerId: null,
            name: ex.name,
            description: ex.description ?? null,
            equipment: ex.equipment,
            primaryMuscles: ex.primaryMuscles,
            secondaryMuscles: ex.secondaryMuscles ?? [],
            instructions: ex.instructions ?? null,
            commonPitfalls: ex.commonPitfalls ?? null,
          },
        });
        created += 1;
      }
    }

    console.log(
      `Seed complete: ${created} system exercise(s) created, ` +
        `${SYSTEM_EXERCISES.length - created} already present.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
