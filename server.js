const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

let otps = {};

const app = express();
app.use(express.json());
const PORT = 5300;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Paths to JSON files
const userFilePath = path.join(__dirname, 'users.json');
const resetTokensPath = path.join(__dirname, 'resetTokens.json'); 
const accommodationFilePath = path.join(__dirname, 'accommodation.json');

// Helper functions for reading and writing JSON data
function readFile(filePath, callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`${path.basename(filePath)} does not exist, initializing with an empty array.`);
                return callback(null, []);
            }
            return callback(err);
        }
        const parsedData = data ? JSON.parse(data) : [];
        callback(null, parsedData);
    });
}

function writeFile(filePath, data, callback) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error(`Error writing to ${path.basename(filePath)} file:`, err);
            return callback(err);
        }
        console.log(`${path.basename(filePath)} data successfully saved.`);
        callback(null);
    });
}



// Function to read user data
const readUserFile = (filePath, callback) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, JSON.parse(data || '[]'));
        }
    });
};

// Function to write user data
const writeUserFile = (filePath, data, callback) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), callback);
};

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mbsravanthi2006@gmail.com',
        pass: 'zfhj kjzl ygdl hnlu' // Use environment variables for security
    }
});

// Route to send OTP to user email
app.post('/api/send-otp', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
    otps[email] = otp; // Store OTP

    const mailOptions = {
        from: 'mbsravanthi2006@gmail.com',
        to: email,
        subject: 'Your OTP for Registration',
        text: `Your OTP is: ${otp}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).json({ message: 'Error sending OTP' });
        }
        res.status(200).json({ message: 'OTP sent to email' });
    });
});

// Route to validate OTP
app.post('/api/validate-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }
    console.log(`Validating OTP for ${email}. Received OTP: ${otp}, Stored OTP: ${otps[email]}`);

    // Check if OTP is correct
    if (otps[email] === otp) {
        delete otps[email]; // OTP is validated, so remove it
        res.status(200).json({ message: 'OTP is valid' });
    } else {
        res.status(400).json({ message: 'Invalid or expired OTP' });
    }
});

// Route to complete registration after OTP validation
app.post('/api/register', (req, res) => {
    const { username, fullName, phone, email, password } = req.body;

    // Ensure all registration fields are present
    if (!username || !fullName || !phone || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    readUserFile(userFilePath, (err, users) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading user data' });
        }

        // Check if user already exists
        if (users.some(user => user.username === username)) {
            return res.status(400).json({ message: 'User already exists!' });
        }

        // Add new user to the file
        const newUser = { username, fullName, phone, email, password };
        users.push(newUser);

        writeUserFile(userFilePath, users, (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error saving user data' });
            }
            res.status(201).json({ message: `${username} registered successfully!` });
        });
    });
});





// Route for user login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    readFile(userFilePath, (err, users) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading user data' });
        }

        const user = users.find(user => user.username === username && user.password === password);
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        res.status(200).json({ message: 'Login successful!' });
    });
});

// Route for forgot password
app.post('/api/forgotpassword', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    // Read user data from the userFilePath
    fs.readFile(userFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading user data' });
        }

        const users = JSON.parse(data);
        const user = users.find(user => user.email === email);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a token
        const token = crypto.randomBytes(20).toString('hex');
        const expirationTime = Date.now() + 3600000; // 1 hour expiration

        // Store the token with the user's email
        fs.readFile(resetTokensPath, 'utf8', (err, tokensData) => {
            if (err) return res.status(500).json({ message: 'Error reading reset tokens' });
            let tokens = [];
            if (tokensData) {
                tokens = JSON.parse(tokensData);
            }
            tokens.push({ email, token, expires: expirationTime });

            // Write updated tokens to file
            fs.writeFile(resetTokensPath, JSON.stringify(tokens), (err) => {
                if (err) return res.status(500).json({ message: 'Error saving reset tokens' });

                // Send email with reset link
                const transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    service: 'Gmail',
                    auth: {
                        user: 'mbsravanthi2006@gmail.com', // replace with your email
                        pass: 'zfhj kjzl ygdl hnlu', // replace with your app password
                    },
                });

                const resetLink = `http://localhost:${PORT}/api/reset-password/${token}`;

                const mailOptions = {
                    from: 'mbsravanthi2006@gmail.com', // Update this to your email
                    to: email,
                    subject: 'Password Reset Request',
                    text: `Click the following link to reset your password: ${resetLink}`,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log("Error sending email:",error);
                        return res.status(500).json({ message: 'Failed to send email' });
                    }
                    res.status(200).json({ message: 'Password reset email sent' });
                });
            });
        });
    });
});
   


// Function to validate the reset token (add your logic here)
function validateToken(token) {
    // Check if the token is valid (this is a placeholder logic)
    return true; // Adjust your logic as needed
}

// Route to handle password reset (POST)
app.post('/api/reset-password/:token', (req, res) => {
    const token = req.params.token;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
    }

    // Read reset tokens
    fs.readFile(resetTokensPath, 'utf8', (err, tokensData) => {
        if (err) return res.status(500).json({ message: 'Error reading reset tokens' });

        const tokens = JSON.parse(tokensData);
        const resetToken = tokens.find(t => t.token === token);

        if (!resetToken) {
            return res.status(404).json({ message: 'Invalid or expired token' });
        }

        // Check if the token has expired
        if (resetToken.expires < Date.now()) {
            return res.status(400).json({ message: 'Token has expired' });
        }

        // Update the user's password
        fs.readFile(userFilePath, 'utf8', (err, userData) => {
            if (err) return res.status(500).json({ message: 'Error reading user data' });

            const users = JSON.parse(userData);
            const user = users.find(u => u.email === resetToken.email);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            user.password = newPassword; // Update password directly

            // Save updated users data
            fs.writeFile(userFilePath, JSON.stringify(users), (err) => {
                if (err) return res.status(500).json({ message: 'Error saving user data' });

                // Optionally, remove the token after successful reset
                tokens.splice(tokens.indexOf(resetToken), 1);
                fs.writeFile(resetTokensPath, JSON.stringify(tokens), (err) => {
                    if (err) return res.status(500).json({ message: 'Error saving reset tokens' });

                    res.status(200).json({ message: 'Password has been reset successfully' });
                });
            });
        });
    });
});

// Route to handle password reset (GET)
app.get('/api/reset-password/:token', (req, res) => {
    const token = req.params.token;

    // Read reset tokens
    fs.readFile(resetTokensPath, 'utf8', (err, tokensData) => {
        if (err) return res.status(500).json({ message: 'Error reading reset tokens' });

        const tokens = JSON.parse(tokensData);
        const resetToken = tokens.find(t => t.token === token);

        if (!resetToken) {
            return res.status(404).json({ message: 'Invalid or expired token' });
        }

        // Check if the token has expired
        if (resetToken.expires < Date.now()) {
            return res.status(400).json({ message: 'Token has expired' });
        }

        // If valid, redirect to the Angular reset password page
        res.redirect(`http://localhost:4200/reset-password/${token}`); // Adjust based on your frontend route
    });
});




// Route for submitting accommodation form


const hotelData = {
    'Visakhapatnam': { name: 'Hotel Visakha', address: 'Beach Road, Visakhapatnam' },
    'Vijayawada': { name: 'Hotel Vijay', address: 'MG Road, Vijayawada' },
    'Guntur': { name: 'Guntur Inn', address: 'Railway Station Rd, Guntur' },
    'Bengaluru': { name: 'Bangalore Residency', address: 'MG Road, Bengaluru' },
    'Mysore': { name: 'Mysore Comfort', address: 'Palace Road, Mysore' },
    'Mumbai': { name: 'Mumbai Stay', address: 'Juhu Beach, Mumbai' },
    // Add other places and hotels as needed
};

// Utility functions for reading/writing JSON data
function readFile(filePath, callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return callback(err);
        callback(null, JSON.parse(data || '[]'));
    });
}

function writeFile(filePath, data, callback) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', callback);
}

// POST route to add accommodation data
app.post('/api/accommodation', (req, res) => {
    const accommodationData = req.body;
    const place = accommodationData.place;
    
    // Add hotel information based on the place selected
    if (hotelData[place]) {
        accommodationData.hotelName = hotelData[place].name;
        accommodationData.hotelAddress = hotelData[place].address;
    }

    // Check required fields
    const requiredFields = [
        'fullName', 'email', 'phone', 'address', 'location', 'place',
        'accommodationType', 'priceRange', 'checkin', 'checkout', 'persons', 
        'roomType', 'payment'
    ];

    for (const field of requiredFields) {
        if (!accommodationData[field]) {
            return res.status(400).json({ message: `Field ${field} is required` });
        }
    }

    // Read, check for duplicates, and write new entry
    readFile(accommodationFilePath, (err, accommodations) => {
        if (err) return res.status(500).json({ message: 'Error reading accommodation data' });

        const isDuplicate = accommodations.some(accom =>
            accom.fullName === accommodationData.fullName &&
            accom.email === accommodationData.email &&
            accom.checkin === accommodationData.checkin &&
            accom.checkout === accommodationData.checkout
        );

        if (isDuplicate) {
            return res.status(400).json({ message: 'Accommodation for the same dates already exists for this user.' });
        }

        accommodations.push(accommodationData);

        writeFile(accommodationFilePath, accommodations, (err) => {
            if (err) return res.status(500).json({ message: 'Error saving accommodation data' });
            res.status(201).json({ message: 'Accommodation data saved successfully!' });
        });
    });
});
// Endpoint to send email
app.post('/api/send-email', (req, res) => {
    const accommodationData = req.body;
  
    const mailOptions = {
      from: 'mbsravanthi2006@gmail.com', // Your email
      to: accommodationData.email, // Sending to the user's email
      subject: 'Accommodation Confirmation',
      text: `Dear ${accommodationData.fullName},\n\nYour accommodation request has been received and it is confirmed.\n\nDetails:\n${JSON.stringify(accommodationData, null, 2)}\n\nThank you!`,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).send({ message: 'Error sending email', error });
      }
      res.send({ message: 'Email sent successfully!', info });
    });
  });
  
// Route to get all accommodation entries
app.get('/api/accommodations', (req, res) => {
    readFile(accommodationFilePath, (err, accommodations) => {
        if (err) return res.status(500).json({ message: 'Error reading accommodation data' });
        res.status(200).json(accommodations);
    });
});




// Route to get all registered users
app.get('/api/users', (req, res) => {
    const formattedData = JSON.stringify(users, null, 2);
    readFile(userFilePath, (err, users) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading user data' });
        }
        res.status(200).json(users);
    });
});

app.get('/', (req, res) => {
    res.send('Server is up and running!');
});

// Feedback POST route
const feedbackFilePath = path.join(__dirname, 'feedback.json');

// Endpoint to submit feedback
app.post('/api/feedback', (req, res) => {
    const newFeedback = req.body;

    // Check if feedback.json exists, and create it if not
    fs.readFile(feedbackFilePath, 'utf8', (err, data) => {
        let feedbackData = [];
        if (!err && data) {
            feedbackData = JSON.parse(data);
        }

        // Append the new feedback entry
        feedbackData.push(newFeedback);

        // Write updated feedback data to feedback.json
        fs.writeFile(feedbackFilePath, JSON.stringify(feedbackData, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Error writing to feedback file:', writeErr);
                return res.status(500).json({ message: 'Failed to save feedback.' });
            }
            res.status(201).json({ message: 'Feedback submitted successfully!' });
        });
    });
});

// Endpoint to retrieve all feedback entries
app.get('/api/feedbacks', (req, res) => {
    fs.readFile(feedbackFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading feedback file:', err);
            return res.status(500).json({ message: 'Failed to load feedback data.' });
        }

        try {
            const feedbackData = JSON.parse(data);
            res.status(200).json(feedbackData);
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            return res.status(500).json({ message: 'Error parsing feedback data.' });
        }
    });
});

// Path for agent registration JSON file
const agentRegFilePath = path.join(__dirname, 'agent-reg.json');

// Ensure JSON file exists
if (!fs.existsSync(agentRegFilePath)) {
    fs.writeFileSync(agentRegFilePath, JSON.stringify([]));
}

// Read and write data functions
const readAgentData = () => JSON.parse(fs.readFileSync(agentRegFilePath, 'utf-8'));
const writeAgentData = (data) => fs.writeFileSync(agentRegFilePath, JSON.stringify(data, null, 2));

// API endpoint to save agent registration data
app.post('/api/agent-register', (req, res) => {
    const { name, email, address, education, referenceName, comments, confirmation } = req.body;

    // Save data to JSON
    const agentData = { name, email, address, education, referenceName, comments, confirmation };
    const existingData = readAgentData();
    existingData.push(agentData);
    writeAgentData(existingData);

    res.status(201).json({ message: 'Agent registered successfully.' });
});

// Endpoint to retrieve all agent registration data
app.get('/api/agent-registers', (req, res) => {
    const agentData = readAgentData();
    res.json(agentData);
});

//Path for Admin login
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});